import {PoofCeloKit} from "../kit"
import {newKit} from "@celo/contractkit"
import {MockWrappedCeloInstance, PoofCELOInstance} from "../../types/truffle-contracts";
import {toBN} from "web3-utils";
const PoofCELO = artifacts.require("PoofCELO");
const MockWrappedCelo = artifacts.require("MockWrappedCelo");

const kit = newKit("http://127.0.0.1:7545")

const toDeposit = 100;

contract("PoofCELO", async (accounts) => {
  let poofCelo: PoofCELOInstance;
  let poofCeloKit: PoofCeloKit;
  let mockWrappedCelo1: MockWrappedCeloInstance;
  let mockWrappedCelo2: MockWrappedCeloInstance;

  const alice = accounts[0];
  const bob = accounts[1];
  const governance = accounts[2];
  const treasury = accounts[3];

  before(async () => {
    poofCelo = await PoofCELO.new();
    await poofCelo.transferOwnership(governance, {from: alice})
    poofCeloKit = new PoofCeloKit(kit, poofCelo.address)

    mockWrappedCelo1 = await MockWrappedCelo.new();
    await mockWrappedCelo1.mint(toDeposit, {from: alice});
    await mockWrappedCelo1.approve(poofCelo.address, toBN(10).pow(toBN(30)), {from: alice});
    await mockWrappedCelo1.setExchangeRate(1);
    mockWrappedCelo2 = await MockWrappedCelo.new();
    await mockWrappedCelo2.mint(toDeposit, {from: bob});
    await mockWrappedCelo2.approve(poofCelo.address, toBN(10).pow(toBN(30)), {from: bob});
    await mockWrappedCelo2.setExchangeRate(4);
  })

  describe("#addWrappedCelo", () => {
    it("should work", async () => {
      assert.equal((await poofCeloKit.wrappedCelos()).length, 0)
      await poofCeloKit.addWrappedCelo(mockWrappedCelo1.address).send({from: governance});
      await poofCeloKit.addWrappedCelo(mockWrappedCelo2.address).send({from: governance});
      assert.equal((await poofCeloKit.wrappedCelos()).length, 2)
    })
  })

  describe("#getTotalSupplyCELO", () => {
    it('should initialize to 0', async () => {
      assert.equal(await poofCeloKit.getTotalSupplyCELO(), "0")
    })
  })

  describe("#deposit", () => {
    it('should disallow depositing 0', async () => {
      try {
        await poofCeloKit.deposit(0, 2).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("Can't deposit a zero amount")
      }
    })
    it('should disallow depositing with an unsupported wrappedCeloIdx', async () => {
      try {
        await poofCeloKit.deposit(1, 2).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("wrappedCeloIdx out of bounds")
      }
    })
    it('should work', async () => {
      // Deposit mockWrappedCelo1
      await poofCeloKit.deposit(toDeposit, 0).send({from: alice})
      assert.isTrue((await poofCelo.balanceOf(alice)).eq(toBN(100)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(alice)).eq(toBN(0)))
      assert.equal((await poofCeloKit.getTotalSupplyCELO()), "100")

      // Deposit mockWrappedCelo2
      await poofCeloKit.deposit(toDeposit, 1).send({from: bob})
      assert.isTrue((await poofCelo.balanceOf(bob)).eq(toBN(400)))
      assert.isTrue((await mockWrappedCelo2.balanceOf(bob)).eq(toBN(0)))
      assert.equal((await poofCeloKit.getTotalSupplyCELO()), "500")
    })
  })

  describe("fees", () => {
    it("should fail if the fee is too high", async () => {
      try {
        await poofCeloKit.setFeeDivisor(99).send({from: governance});
      } catch (e) {
        expect(e.message).to.contain("New fee rate is too high");
      }
    })
    it("should set properly", async () => {
      poofCeloKit.setFeeTo(treasury).send({from: governance});
      assert.equal(await poofCelo.feeTo(), treasury)
      poofCeloKit.setFeeDivisor(100).send({from: governance});
      assert.isTrue((await poofCelo.feeDivisor()).eq(toBN(100)))
      poofCeloKit.clearFeeDivisor().send({from: governance});
      assert.isTrue((await poofCelo.feeDivisor()).eq(toBN(0)))
      poofCeloKit.setFeeDivisor(100).send({from: governance});
      assert.isTrue((await poofCelo.feeDivisor()).eq(toBN(100)))
    })
  })

  describe("#withdraw", () => {
    it('should disallow withdrawing 0', async () => {
      try {
        await poofCeloKit.withdraw(0).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("Can't withdraw a zero amount")
      }
    })
    it('should work', async () => {
      // Withdraw for Alice. She has 100 pCELO which is 1/5 of the total supply
      const toReturn1 = toBN(100).div(toBN(5))
      const fee1 = toReturn1.div(toBN(100));
      await poofCeloKit.withdraw(toDeposit).send({from: alice})
      assert.isTrue((await poofCelo.balanceOf(alice)).eq(toBN(0)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(alice)).eq(toReturn1.sub(fee1)))
      assert.isTrue((await mockWrappedCelo2.balanceOf(alice)).eq(toReturn1.sub(fee1)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(treasury)).eq(fee1))
      assert.isTrue((await mockWrappedCelo2.balanceOf(treasury)).eq(fee1))
      assert.equal((await poofCeloKit.getTotalSupplyCELO()), (toDeposit * 4).toString())

      // Withdraw for Bob. He has 400 pCELO which is 4x what Alice had
      const toReturn2 = toReturn1.mul(toBN(4))
      const fee2 = toReturn2.div(toBN(100));
      await poofCeloKit.withdraw(toDeposit * 4).send({from: bob})
      assert.isTrue((await poofCelo.balanceOf(bob)).eq(toBN(0)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(bob)).eq(toReturn2.sub(fee2)))
      assert.isTrue((await mockWrappedCelo2.balanceOf(bob)).eq(toReturn2.sub(fee2)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(treasury)).eq(fee1.add(fee2)))
      assert.isTrue((await mockWrappedCelo2.balanceOf(treasury)).eq(fee1.add(fee2)))
      assert.equal((await poofCeloKit.getTotalSupplyCELO()), "0")
    })
  })

  describe("banning", () => {
    it("should work", async () => {
      await poofCeloKit.banWrappedCelo(0).send({from: governance})
      try {
        await poofCeloKit.deposit(5, 0).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("Selected wrappedCelo is banned")
      }
      await poofCeloKit.unbanWrappedCelo(0).send({from: governance})
      await poofCeloKit.deposit(5, 0).send({from: alice})
    })
  })

})
