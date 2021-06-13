import {RewardsCeloKit} from "../kit"
import {newKit} from "@celo/contractkit"
import {RewardsCELOInstance} from "../../types/truffle-contracts";
import {toBN, toWei} from "web3-utils";
const RewardsCELO = artifacts.require("RewardsCELO");
const MockWrappedCelo = artifacts.require("MockWrappedCelo");

const kit = newKit("http://127.0.0.1:7545")

const toDeposit = 100;


contract("RewardsCELO", async (accounts) => {
  let rewardsCelo: RewardsCELOInstance;
  let rewardsCeloKit: RewardsCeloKit;

  const alice = accounts[0];

  before(async () => {
    rewardsCelo = await RewardsCELO.new();
    rewardsCeloKit = new RewardsCeloKit(kit, rewardsCelo.address)
  })

  describe("wrappedCelos benchmarking", () => {
    it("should benchmark", async () => {
      const gasPrice = "0.1"
      console.info(`Gas price is ${gasPrice} gwei`)
      for (let i = 1; i <= 100; i++) {
        const mockWrappedCelo = await MockWrappedCelo.new();
        await mockWrappedCelo.mint(toDeposit, {from: alice});
        await mockWrappedCelo.approve(rewardsCelo.address, toBN(10).pow(toBN(30)), {from: alice});
        await mockWrappedCelo.setExchangeRate(1);
        await rewardsCeloKit.addWrappedCelo(mockWrappedCelo.address).send({from: alice});

        const txn = await rewardsCeloKit.deposit(toDeposit, i - 1).send({
          from: alice,
          gasPrice: toWei(gasPrice, 'gwei'),
        })
        const receipt = await txn.waitReceipt()

        if (i % 10 === 0) {
          console.info(`Gas used @ ${i} wrappedCelos: ${receipt.gasUsed}.`)
        }
      }
    })
  })
})
