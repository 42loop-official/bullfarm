// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';

contract BullFarmSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IUniswapV2Router02 public uniswapRouter;
    IUniswapV2Factory public uniswapFactory;
    uint256 public taxPercentage; // Tax percentage (e.g., 5 for 5%)
    uint256 public defaultSlippagePercentage; // Default slippage percentage (e.g., 5 for 5%)
    bool public paused = false; // Pausing state for emergency

    event TaxPercentageUpdated(uint256 newTaxPercentage);
    event DefaultSlippagePercentageUpdated(uint256 newSlippagePercentage);
    event TokensSwapped(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );
    event TaxHandled(
        address indexed tokenIn,
        uint256 taxAmount,
        uint256 ethAmount
    );
    event EthReceived(address indexed sender, uint256 amount);
    event Paused(bool isPaused);
    event EmergencyWithdraw(address indexed token, uint256 amount);

    constructor(
        address _uniswapRouter,
        uint256 _taxPercentage,
        uint256 _defaultSlippagePercentage
    ) Ownable(msg.sender) {
        require(_uniswapRouter != address(0), 'Invalid Uniswap router address');
        require(
            _taxPercentage <= 100,
            'Tax percentage must be between 0 and 100'
        );
        require(
            _defaultSlippagePercentage <= 100,
            'Slippage percentage must be between 0 and 100'
        );

        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        uniswapFactory = IUniswapV2Factory(uniswapRouter.factory());
        taxPercentage = _taxPercentage;
        defaultSlippagePercentage = _defaultSlippagePercentage;
    }

    modifier whenNotPaused() {
        require(!paused, 'Contract is paused');
        _;
    }

    function calculateAmountOutMin(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippagePercentage
    ) public view returns (uint256 amountOutMin) {
        require(amountIn > 0, 'Amount in must be greater than 0');
        require(
            tokenIn != address(0) && tokenOut != address(0),
            'Invalid token address'
        );

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amountsOut = uniswapRouter.getAmountsOut(
            amountIn,
            path
        );
        uint256 amountOut = amountsOut[1]; // Index 1 represents the tokenOut

        // Apply slippage tolerance
        amountOutMin = amountOut - (amountOut * slippagePercentage) / 100;
    }

    function swapExactETHForTokens(
        address tokenOut,
        uint256 deadline,
        uint256 slippagePercentage
    )
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256[] memory amounts)
    {
        require(msg.value > 0, 'Amount in must be greater than 0');
        require(tokenOut != address(0), 'Invalid token address');
        require(block.timestamp <= deadline, 'Transaction expired');

        if (slippagePercentage == 0) {
            slippagePercentage = defaultSlippagePercentage;
        }

        require(
            slippagePercentage <= 100,
            'Slippage percentage must be between 0 and 100'
        );

        uint256 taxAmount = Math.ceilDiv(msg.value * taxPercentage, 100);
        uint256 amountInAfterTax = msg.value - taxAmount;

        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH(); // WETH as the input token
        path[1] = tokenOut;

        uint256 amountOutMin = calculateAmountOutMin(
            path[0],
            tokenOut,
            amountInAfterTax,
            slippagePercentage
        );

        amounts = uniswapRouter.swapExactETHForTokens{value: amountInAfterTax}(
            amountOutMin,
            path,
            msg.sender,
            deadline
        );

        emit TokensSwapped(
            uniswapRouter.WETH(),
            tokenOut,
            msg.value,
            amounts[1],
            msg.sender
        );

        // Handle tax
        handleTax(uniswapRouter.WETH(), taxAmount);
    }

    function swapPercentageOfTokensForETH(
        address tokenIn,
        uint256 percentage,
        uint256 deadline,
        uint256 slippagePercentage
    ) external whenNotPaused nonReentrant returns (uint256[] memory amounts) {
        require(
            percentage > 0 && percentage <= 100,
            'Percentage must be between 1 and 100'
        );
        require(tokenIn != address(0), 'Invalid token address');
        require(block.timestamp <= deadline, 'Transaction expired');

        uint256 balance = IERC20(tokenIn).balanceOf(msg.sender);
        uint256 amountIn = (balance * percentage) / 100;

        require(amountIn > 0, 'Calculated amount in must be greater than 0');

        if (slippagePercentage == 0) {
            slippagePercentage = defaultSlippagePercentage;
        }
        require(
            slippagePercentage <= 100,
            'Slippage percentage must be between 0 and 100'
        );

        uint256 taxAmount = Math.ceilDiv(amountIn * taxPercentage, 100);
        uint256 amountInAfterTax = amountIn - taxAmount;
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeIncreaseAllowance(
            address(uniswapRouter),
            amountInAfterTax
        );

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = uniswapRouter.WETH();

        // Handle tax
        handleTax(tokenIn, taxAmount);

        uint256 amountOutMin = calculateAmountOutMin(
            tokenIn,
            path[1],
            amountInAfterTax,
            slippagePercentage
        );

        amounts = uniswapRouter.swapExactTokensForETH(
            amountInAfterTax,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );

        emit TokensSwapped(
            tokenIn,
            address(0),
            amountInAfterTax,
            amounts[1],
            msg.sender
        );
    }

    function swapExactTokensForETH(
        address tokenIn,
        uint256 amountIn,
        uint256 deadline,
        uint256 slippagePercentage
    ) external whenNotPaused nonReentrant returns (uint256[] memory amounts) {
        require(amountIn > 0, 'Amount in must be greater than 0');
        require(tokenIn != address(0), 'Invalid token address');
        require(block.timestamp <= deadline, 'Transaction expired');

        if (slippagePercentage == 0) {
            slippagePercentage = defaultSlippagePercentage;
        }
        require(
            slippagePercentage <= 100,
            'Slippage percentage must be between 0 and 100'
        );

        uint256 taxAmount = Math.ceilDiv(amountIn * taxPercentage, 100);
        uint256 amountInAfterTax = amountIn - taxAmount;

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeIncreaseAllowance(
            address(uniswapRouter),
            amountInAfterTax
        );

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = uniswapRouter.WETH();

        // Handle tax
        handleTax(tokenIn, taxAmount);

        uint256 amountOutMin = calculateAmountOutMin(
            tokenIn,
            path[1],
            amountInAfterTax,
            slippagePercentage
        );

        amounts = uniswapRouter.swapExactTokensForETH(
            amountInAfterTax,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );

        emit TokensSwapped(
            tokenIn,
            address(0),
            amountInAfterTax,
            amounts[1],
            msg.sender
        );
    }

    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 deadline,
        uint256 slippagePercentage
    ) external whenNotPaused nonReentrant returns (uint256[] memory amounts) {
        require(amountIn > 0, 'Amount in must be greater than 0');
        require(
            tokenIn != address(0) && tokenOut != address(0),
            'Invalid token address'
        );
        require(block.timestamp <= deadline, 'Transaction expired');

        if (slippagePercentage == 0) {
            slippagePercentage = defaultSlippagePercentage;
        }
        require(
            slippagePercentage <= 100,
            'Slippage percentage must be between 0 and 100'
        );
        uint256 taxAmount = Math.ceilDiv(amountIn * taxPercentage, 100);
        uint256 amountInAfterTax = amountIn - taxAmount;

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeIncreaseAllowance(
            address(uniswapRouter),
            amountInAfterTax
        );

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256 amountOutMin = calculateAmountOutMin(
            tokenIn,
            tokenOut,
            amountInAfterTax,
            slippagePercentage
        );

        amounts = uniswapRouter.swapExactTokensForTokens(
            amountInAfterTax,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );

        emit TokensSwapped(
            tokenIn,
            tokenOut,
            amountInAfterTax,
            amounts[1],
            msg.sender
        );

        // Handle tax
        handleTax(tokenIn, taxAmount);
    }

    function handleTax(address tokenIn, uint256 taxAmount) internal {
        require(taxAmount > 0, 'Tax amount must be greater than 0');
        uint256 ethReceived;

        if (tokenIn == uniswapRouter.WETH()) {
            require(
                address(this).balance >= taxAmount,
                'Insufficient ETH balance'
            );
            (bool success, ) = owner().call{value: taxAmount}('');
            require(success, 'Failed to send ETH tax to owner');

            emit TaxHandled(tokenIn, taxAmount, taxAmount);
        } else {
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = uniswapRouter.WETH();

            IERC20(tokenIn).safeIncreaseAllowance(
                address(uniswapRouter),
                taxAmount
            );

            // Calculate the minimum amount of ETH to accept, applying the default slippage
            uint256[] memory amountsOut = uniswapRouter.getAmountsOut(
                taxAmount,
                path
            );
            uint256 amountOutMin = amountsOut[1] -
                (amountsOut[1] * defaultSlippagePercentage) /
                100;

            uint256[] memory amounts = uniswapRouter.swapExactTokensForETH(
                taxAmount,
                amountOutMin, // Apply slippage tolerance
                path,
                address(this), // Send ETH to this contract
                block.timestamp
            );

            ethReceived = amounts[1];
            require(ethReceived > 0, 'No ETH received from swap');

            (bool success, ) = owner().call{value: ethReceived}('');
            require(success, 'Failed to send ETH tax to owner');

            emit TaxHandled(tokenIn, taxAmount, ethReceived);
        }
    }

    function setTaxPercentage(uint256 _taxPercentage) external onlyOwner {
        require(
            _taxPercentage <= 100,
            'Tax percentage must be between 0 and 100'
        );
        taxPercentage = _taxPercentage;

        emit TaxPercentageUpdated(_taxPercentage);
    }

    function setDefaultSlippagePercentage(
        uint256 _defaultSlippagePercentage
    ) external onlyOwner {
        require(
            _defaultSlippagePercentage <= 100,
            'Slippage percentage must be between 0 and 100'
        );
        defaultSlippagePercentage = _defaultSlippagePercentage;

        emit DefaultSlippagePercentageUpdated(_defaultSlippagePercentage);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, 'No token balance to withdraw');
        IERC20(token).safeTransfer(owner(), balance);
        emit EmergencyWithdraw(token, balance);
    }

    // New function to get token info including liquidity
    function getTokenInfo(
        address token
    )
        external
        view
        returns (
            string memory name,
            string memory symbol,
            uint256 totalSupply,
            address owner,
            address pair,
            uint256 tokenLiquidity,
            uint256 pairedTokenLiquidity
        )
    {
        require(token != address(0), 'Invalid token address');

        // Retrieve basic ERC20 metadata
        name = IERC20Metadata(token).name();
        symbol = IERC20Metadata(token).symbol();
        totalSupply = IERC20(token).totalSupply();

        // Assuming the owner is the deployer or has been set; normally, this is handled by the token contract itself.
        owner = Ownable(token).owner();

        // Get liquidity information
        pair = uniswapFactory.getPair(token, uniswapRouter.WETH());
        if (pair != address(0)) {
            // Get reserves from the pair
            (uint112 reserve0, uint112 reserve1, ) = IUniswapV2Pair(pair)
                .getReserves();

            // Get token liquidity (assuming token is token0 in the pair)
            address token0 = IUniswapV2Pair(pair).token0();
            if (token0 == token) {
                tokenLiquidity = reserve0;
                pairedTokenLiquidity = reserve1; // This is the WETH or other paired token's liquidity
            } else {
                tokenLiquidity = reserve1;
                pairedTokenLiquidity = reserve0;
            }
        } else {
            tokenLiquidity = 0; // No liquidity found
            pairedTokenLiquidity = 0;
        }
    }

    // Fallback function to receive ETH when swapping token to ETH
    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }
}
