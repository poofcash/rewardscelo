import {RewardsCeloKit} from "../kit"
import {newKit} from "@celo/contractkit"
import {MockWrappedCeloInstance, RewardsCELOInstance} from "../../types/truffle-contracts";
import {toBN} from "web3-utils";
const RewardsCELO = artifacts.require("RewardsCELO");
const MockWrappedCelo = artifacts.require("MockWrappedCelo");

const kit = newKit("http://127.0.0.1:7545")

const toDeposit = 100;

contract("RewardsCELO", async (accounts) => {
  let rewardsCelo: RewardsCELOInstance;
  let rewardsCeloKit: RewardsCeloKit;
  let mockWrappedCelo1: MockWrappedCeloInstance;
  let mockWrappedCelo2: MockWrappedCeloInstance;

  const alice = accounts[0];
  const bob = accounts[1];
  const governance = accounts[2];
  const treasury = accounts[3];

  before(async () => {
    rewardsCelo = await RewardsCELO.new();
    await rewardsCelo.transferOwnership(governance, {from: alice})
    rewardsCeloKit = new RewardsCeloKit(kit, rewardsCelo.address)

    mockWrappedCelo1 = await MockWrappedCelo.new();
    await mockWrappedCelo1.mint(toDeposit, {from: alice});
    await mockWrappedCelo1.approve(rewardsCelo.address, toBN(10).pow(toBN(30)), {from: alice});
    await mockWrappedCelo1.setExchangeRate(1);
    mockWrappedCelo2 = await MockWrappedCelo.new();
    await mockWrappedCelo2.mint(toDeposit, {from: bob});
    await mockWrappedCelo2.approve(rewardsCelo.address, toBN(10).pow(toBN(30)), {from: bob});
    await mockWrappedCelo2.setExchangeRate(4);
  })

  describe("#addWrappedCelo", () => {
    it("should work", async () => {
      assert.equal((await rewardsCeloKit.wrappedCelos()).length, 0)
      await rewardsCeloKit.addWrappedCelo(mockWrappedCelo1.address).send({from: governance});
      await rewardsCeloKit.addWrappedCelo(mockWrappedCelo2.address).send({from: governance});
      assert.equal((await rewardsCeloKit.wrappedCelos()).length, 2)
    })
  })

  describe("#getTotalSupplyCELO", () => {
    it('should initialize to 0', async () => {
      assert.equal(await rewardsCeloKit.getTotalSupplyCELO(), "0")
    })
  })

  describe("#deposit", () => {
    it('should disallow depositing 0', async () => {
      try {
        await rewardsCeloKit.deposit(0, 2).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("Can't deposit a zero amount")
      }
    })
    it('should disallow depositing with an unsupported wrappedCeloIdx', async () => {
      try {
        await rewardsCeloKit.deposit(1, 2).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("wrappedCeloIdx out of bounds")
      }
    })
    it('should work', async () => {
      // Deposit mockWrappedCelo1
      await rewardsCeloKit.deposit(toDeposit, 0).send({from: alice})
      assert.isTrue((await rewardsCelo.balanceOf(alice)).eq(toBN(100)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(alice)).eq(toBN(0)))
      assert.equal((await rewardsCeloKit.getTotalSupplyCELO()), "100")

      // Deposit mockWrappedCelo2
      await rewardsCeloKit.deposit(toDeposit, 1).send({from: bob})
      assert.isTrue((await rewardsCelo.balanceOf(bob)).eq(toBN(400)))
      assert.isTrue((await mockWrappedCelo2.balanceOf(bob)).eq(toBN(0)))
      assert.equal((await rewardsCeloKit.getTotalSupplyCELO()), "500")
    })
  })

  describe("fees", () => {
    it("should fail if the fee is too high", async () => {
      try {
        await rewardsCeloKit.setFeeDivisor(99).send({from: governance});
      } catch (e) {
        expect(e.message).to.contain("New fee rate is too high");
      }
    })
    it("should set properly", async () => {
      rewardsCeloKit.setFeeTo(treasury).send({from: governance});
      assert.equal(await rewardsCelo.feeTo(), treasury)
      rewardsCeloKit.setFeeDivisor(100).send({from: governance});
      assert.isTrue((await rewardsCelo.feeDivisor()).eq(toBN(100)))
      rewardsCeloKit.clearFeeDivisor().send({from: governance});
      assert.isTrue((await rewardsCelo.feeDivisor()).eq(toBN(0)))
      rewardsCeloKit.setFeeDivisor(100).send({from: governance});
      assert.isTrue((await rewardsCelo.feeDivisor()).eq(toBN(100)))
    })
  })

  describe("#withdraw", () => {
    it('should disallow withdrawing 0', async () => {
      try {
        await rewardsCeloKit.withdraw(0).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("Can't withdraw a zero amount")
      }
    })
    it('should work', async () => {
      // Withdraw for Alice. She has 100 pCELO which is 1/5 of the total supply
      const toReturn1 = toBN(100).div(toBN(5))
      const fee1 = toReturn1.div(toBN(100));
      await rewardsCeloKit.withdraw(toDeposit).send({from: alice})
      assert.isTrue((await rewardsCelo.balanceOf(alice)).eq(toBN(0)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(alice)).eq(toReturn1.sub(fee1)))
      assert.isTrue((await mockWrappedCelo2.balanceOf(alice)).eq(toReturn1.sub(fee1)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(treasury)).eq(fee1))
      assert.isTrue((await mockWrappedCelo2.balanceOf(treasury)).eq(fee1))
      assert.equal((await rewardsCeloKit.getTotalSupplyCELO()), (toDeposit * 4).toString())

      // Withdraw for Bob. He has 400 pCELO which is 4x what Alice had
      const toReturn2 = toReturn1.mul(toBN(4))
      const fee2 = toReturn2.div(toBN(100));
      await rewardsCeloKit.withdraw(toDeposit * 4).send({from: bob})
      assert.isTrue((await rewardsCelo.balanceOf(bob)).eq(toBN(0)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(bob)).eq(toReturn2.sub(fee2)))
      assert.isTrue((await mockWrappedCelo2.balanceOf(bob)).eq(toReturn2.sub(fee2)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(treasury)).eq(fee1.add(fee2)))
      assert.isTrue((await mockWrappedCelo2.balanceOf(treasury)).eq(fee1.add(fee2)))
      assert.equal((await rewardsCeloKit.getTotalSupplyCELO()), "0")
    })
  })

  describe("banning", () => {
    it("should work", async () => {
      await rewardsCeloKit.banWrappedCelo(0).send({from: governance})
      try {
        await rewardsCeloKit.deposit(5, 0).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("Selected wrappedCelo is banned")
      }
      await rewardsCeloKit.unbanWrappedCelo(0).send({from: governance})
      await rewardsCeloKit.deposit(5, 0).send({from: alice})
    })
  })

})
