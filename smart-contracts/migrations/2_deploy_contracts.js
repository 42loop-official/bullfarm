require("dotenv").config();
const BullFarmSwap = artifacts.require("BullFarmSwap");

module.exports = function (deployer) {
    deployer.deploy(BullFarmSwap, process.env.UNISWAP_ROUTER_ADDRESS, 1, 5);  // Thay thế UNISWAP_ROUTER_ADDRESS bằng địa chỉ router của Uniswap
};
