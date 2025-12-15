import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Deploying PlinkoGame contract...");
  console.log("Deployer address:", deployer);

  const deployedPlinkoGame = await deploy("PlinkoGame", {
    from: deployer,
    log: true,
    waitConfirmations: hre.network.name === "sepolia" ? 5 : 1,
  });

  console.log(`PlinkoGame contract deployed at: ${deployedPlinkoGame.address}`);
  console.log(`Transaction hash: ${deployedPlinkoGame.transactionHash}`);
  
  if (hre.network.name === "sepolia") {
    console.log("\nWaiting for block confirmations...");
    console.log("Contract address:", deployedPlinkoGame.address);
    console.log("\nTo verify on Etherscan, run:");
    console.log(`npx hardhat verify --network sepolia ${deployedPlinkoGame.address}`);
  }
};

export default func;
func.id = "deploy_plinkoGame";
func.tags = ["PlinkoGame"];
