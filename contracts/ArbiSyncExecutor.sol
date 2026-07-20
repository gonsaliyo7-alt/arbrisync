// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArbiSyncExecutor
 * @dev Smart Contract for Atomic Arbitrage using Uniswap V3 Flash Swaps as loan sources
 * and executing swaps on Uniswap V3, PancakeSwap V3, Uniswap V2, and Aerodrome (Base).
 */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

// Aerodrome Router Interface
interface IAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }
    
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IUniswapV3Pool {
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
}

contract ArbiSyncExecutor {
    address public owner;

    // Aerodrome Router Address on Base
    address public constant AERODROME_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address public constant AERODROME_FACTORY = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;
    address public constant WETH_ADDRESS = 0x4200000000000000000000000000000000000006;

    struct ArbitrageParams {
        address token;
        uint256 amount;
        address buyDex;
        address sellDex;
        uint256 minProfit;
        address stableToken;
        bool isV3Buy;
        bool isV3Sell;
        uint24 poolFeeBuy;
        uint24 poolFeeSell;
        address loanPool;
    }

    event ArbitrageExecuted(address indexed token, uint256 amount, uint256 profit);
    event Withdraw(address indexed token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Performs a direct arbitrage without using a flash loan
     */
    function executeDirectArbitrage(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address buyDex,
        address sellDex,
        uint256 minProfit,
        bool isV3Buy,
        bool isV3Sell,
        uint24 poolFeeBuy,
        uint24 poolFeeSell
    ) public payable onlyOwner returns (uint256) {
        if (msg.value > 0) {
            require(tokenIn == WETH_ADDRESS, "ETH recibido pero tokenIn no es WETH");
            IWETH(WETH_ADDRESS).deposit{value: msg.value}();
        }

        uint256 balanceBefore = IERC20(tokenIn).balanceOf(address(this));
        require(balanceBefore >= amountIn, "Saldo tokenIn insuficiente");

        uint256 midBalance = _swap(
            buyDex,
            tokenIn,
            tokenOut,
            amountIn,
            isV3Buy,
            poolFeeBuy
        );

        uint256 endBalance = _swap(
            sellDex,
            tokenOut,
            tokenIn,
            midBalance,
            isV3Sell,
            poolFeeSell
        );

        require(endBalance > amountIn, "Arbitraje no rentable");
        uint256 profit = endBalance - amountIn;
        require(profit >= minProfit, "Profit insuficiente");

        IERC20(tokenIn).transfer(owner, profit);

        emit ArbitrageExecuted(tokenOut, amountIn, profit);
        return profit;
    }

    // Unused helper, kept for interface compatibility if needed or removed
    function swapExternal(
        address dexRouter,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bool isV3,
        uint24 poolFee
    ) external returns (uint256) {
        require(msg.sender == address(this), "Only self");
        return _swap(dexRouter, tokenIn, tokenOut, amountIn, isV3, poolFee);
    }

    /**
     * @notice Initiates the arbitrage by triggering a Flash Swap on a Uniswap V3 Pool.
     */
    function executeArbitrage(
        address token,
        address stableToken,
        uint256 amount,
        address buyDex,
        address sellDex,
        uint256 minProfit,
        bool isV3Buy,
        bool isV3Sell,
        uint24 poolFeeBuy,
        uint24 poolFeeSell,
        address loanPool
    ) public onlyOwner returns (uint256) {
        bytes memory data = abi.encode(
            ArbitrageParams({
                token: token,
                amount: amount,
                buyDex: buyDex,
                sellDex: sellDex,
                minProfit: minProfit,
                stableToken: stableToken,
                isV3Buy: isV3Buy,
                isV3Sell: isV3Sell,
                poolFeeBuy: poolFeeBuy,
                poolFeeSell: poolFeeSell,
                loanPool: loanPool
            })
        );

        uint256 balanceBefore = IERC20(stableToken).balanceOf(address(this));

        uint256 amount0 = 0;
        uint256 amount1 = 0;
        if (stableToken < token) {
            amount0 = amount;
        } else {
            amount1 = amount;
        }

        IUniswapV3Pool(loanPool).flash(address(this), amount0, amount1, data);

        uint256 balanceAfter = IERC20(stableToken).balanceOf(address(this));
        uint256 profit = balanceAfter - balanceBefore;

        require(profit >= minProfit, "Profit insuficiente en la ejecucion");

        if (profit > 0) {
            IERC20(stableToken).transfer(owner, profit);
        }

        emit ArbitrageExecuted(token, amount, profit);
        return profit;
    }

    /**
     * @notice Uniswap V3 Flash callback.
     */
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        require(msg.sender == params.loanPool, "Only triggerable by Uniswap V3 Pool");

        uint256 fee = fee0 > 0 ? fee0 : fee1;
        uint256 amountToRepay = params.amount + fee;

        uint256 midBalance = _swap(
            params.buyDex,
            params.stableToken,
            params.token,
            params.amount,
            params.isV3Buy,
            params.poolFeeBuy
        );

        uint256 endBalance = _swap(
            params.sellDex,
            params.token,
            params.stableToken,
            midBalance,
            params.isV3Sell,
            params.poolFeeSell
        );

        require(endBalance >= amountToRepay, "Arbitraje no rentable (reversion de seguridad)");

        IERC20(params.stableToken).transfer(msg.sender, amountToRepay);
    }

    function _swap(
        address dexRouter,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bool isV3,
        uint24 poolFee
    ) internal returns (uint256) {
        if (amountIn == 0) return 0;
        IERC20(tokenIn).approve(dexRouter, amountIn);

        // Check if routing through Aerodrome Router
        if (dexRouter == AERODROME_ROUTER) {
            return _swapAerodrome(tokenIn, tokenOut, amountIn);
        }

        if (isV3) {
            return ISwapRouter(dexRouter).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: poolFee,
                    recipient: address(this),
                    amountIn: amountIn,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
        } else {
            return _swapV2(dexRouter, tokenIn, tokenOut, amountIn);
        }
    }

    function _swapV2(
        address dexRouter,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        IERC20(tokenIn).approve(dexRouter, amountIn);
        IUniswapV2Router router = IUniswapV2Router(dexRouter);
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp + 300
        );
        return amounts[amounts.length - 1];
    }

    function _swapAerodrome(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        IERC20(tokenIn).approve(AERODROME_ROUTER, amountIn);
        IAerodromeRouter router = IAerodromeRouter(AERODROME_ROUTER);
        
        // Build route path. Aerodrome router uses Route structs.
        // We assume unstable pool (volatil/standard) as default for most pairs, fallback to stable if required.
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({
            from: tokenIn,
            to: tokenOut,
            stable: false,
            factory: AERODROME_FACTORY
        });

        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            0,
            routes,
            address(this),
            block.timestamp + 300
        );
        return amounts[amounts.length - 1];
    }

    function withdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, balance);
        emit Withdraw(token, balance);
    }

    function withdrawEther() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Transfer failed");
        emit Withdraw(address(0), balance);
    }

    receive() external payable {}
}
