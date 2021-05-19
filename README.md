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
