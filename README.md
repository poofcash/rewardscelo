# Poof CELO

Poof CELO is a wrapper around wrapper CELO tokens like [SavingsCELO](https://github.com/zviadm/savingscelo). Poof CELO allows users to earn interest using any interest bearing CELO wrapper they choose.

## Usage
```
npm i
npm run build
npm run test
```

## Depositing
pCELO supports depositing any wrapped CELO defined in the `wrappedCelos` array. Depositing is in units of the wrapped CELO. The amount of pCELO minted is determined by the following ratio:

```
toMint / pCELO.totalSupply() = savingsToCELO(toDeposit) / totalSupplyCELO
```

## Withdrawing
pCELO forces users to withdraw from every supported wrapped CELO. Withdrawing is in units of pCELO. Every wrapped CELO is withdrawn at a ratio of

```
toWithdraw / pCELO.totalSupply()
```
pCELO was designed this way to prevent users from depositing aCELO and withdrawing bCELO. 

## Benchmarking
Deposit and withdraw each iterate over the list of wrappedCelos. Each added wrappedCelo will make transactions more expensive. This benchmark describes how the gasUsed increases as the number of wrappedCelos increases:

```
  Contract: PoofCELO
    wrappedCelos benchmarking
Gas price is 0.1 gwei
Gas used @ 10 wrappedCelos: 119676.
Gas used @ 20 wrappedCelos: 176009.
Gas used @ 30 wrappedCelos: 232344.
Gas used @ 40 wrappedCelos: 288680.
Gas used @ 50 wrappedCelos: 345018.
Gas used @ 60 wrappedCelos: 401358.
Gas used @ 70 wrappedCelos: 457698.
Gas used @ 80 wrappedCelos: 514041.
Gas used @ 90 wrappedCelos: 570385.
Gas used @ 100 wrappedCelos: 626731.
```

which can roughly be modeled linearly:

```
y = 5633.3x + 63343
```

13M gas block limit would support up to 2,296 wrapped CELOs

This can be replicated via:
```
npm run bench
```

