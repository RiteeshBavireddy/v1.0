import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import '@typechain/hardhat'

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  // other configuration options
};

export default config;

