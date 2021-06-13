const RewardsCELO = artifacts.require("RewardsCELO");
const MockWrappedCelo = artifacts.require("MockWrappedCelo");

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    const rCELO = await deployer.deploy(RewardsCELO);
    if (network === "mainnet") {
      // Add savings CELO
      await rCELO.addWrappedCelo("0x2879BFD5e7c4EF331384E908aaA3Bd3014b703fA");
    } else if (network === "alfajores") {
      const mwCELO = await deployer.deploy(MockWrappedCelo);
      await rCELO.addWrappedCelo(mwCELO.address)
    }
  })
};

