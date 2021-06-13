import {PoofCeloKit} from "../kit"
import {newKit} from "@celo/contractkit"
import {PoofCELOInstance} from "../../types/truffle-contracts";
import {toBN, toWei} from "web3-utils";
const PoofCELO = artifacts.require("PoofCELO");
const MockWrappedCelo = artifacts.require("MockWrappedCelo");

const kit = newKit("http://127.0.0.1:7545")

const toDeposit = 100;


contract("PoofCELO", async (accounts) => {
  let poofCelo: PoofCELOInstance;
  let poofCeloKit: PoofCeloKit;

  const alice = accounts[0];

  before(async () => {
    poofCelo = await PoofCELO.new();
    poofCeloKit = new PoofCeloKit(kit, poofCelo.address)
  })

  describe("wrappedCelos benchmarking", () => {
    it("should benchmark", async () => {
      const gasPrice = "0.1"
      console.info(`Gas price is ${gasPrice} gwei`)
      for (let i = 1; i <= 100; i++) {
        const mockWrappedCelo = await MockWrappedCelo.new();
        await mockWrappedCelo.mint(toDeposit, {from: alice});
        await mockWrappedCelo.approve(poofCelo.address, toBN(10).pow(toBN(30)), {from: alice});
        await mockWrappedCelo.setExchangeRate(1);
        await poofCeloKit.addWrappedCelo(mockWrappedCelo.address).send({from: alice});

        const txn = await poofCeloKit.deposit(toDeposit, i - 1).send({
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
