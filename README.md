# Installation for module

`npm install cnc-blockchain`
or
`yarn add cnc-blockchain`

# Usage

### Join cnc-blockchain network

```
const cncBlockchain= require('cnc-blockchain');

const network= cncBlockchain.joinNetwork(ready=>{
  if(ready){
    //network is ready!
    //...
  }
});
```

After joining network, you can use cnc-blockchain-network's functions!

(also automatically request and update blockchain data)

### Make new transaction

```
const {joinNetwork, Transacton, generateKey, CMD_MAKE_PTX}= require('cnc-blockchain);

const network= cncBlockchain.joinNetwork(ready=>{
  if(ready){
    //network is ready!

    const user1= generateKey();
    const user2= generateKey();

    //This tx means user1 send 0 coin to user2
    const tx= new Transaction(user1.getPublic('hex'), user2.getPublic('hex'), 0);

    //sign to tx (sender must sign transaction)
    tx.signTransaction(user1);

    //submit tx to blockchain network
    network.sendCMD(CMD_MAKE_PTX, tx);
  }
});
```

You create transaction(user1 send 0 coin to user2) and submit transaction to blockchain network.

Be aware this transaction is now pending state(waiting for allowing validation by users in network).

How to transform pending transaction to allowed transaction (on block)?

### Mine(Create) new block

For transform pending transaction to real-valid transaction, you should mining(create) new block including that transaction.

Only on-block transaction is allowed as real-data.

```
const {joinNetwork, Transacton, generateKey, CMD_MAKE_PTX, CMD_MAKE_BLOCK}= require('cnc-blockchain);

const network= cncBlockchain.joinNetwork(ready=>{
  if(ready){
    //network is ready!

    const user1= generateKey();
    const user2= generateKey();

    //This tx means user1 send 0 coin to user2
    const tx= new Transaction(user1.getPublic('hex'), user2.getPublic('hex'), 0);

    //sign to tx (sender must sign transaction)
    tx.signTransaction(user1);

    //submit tx to blockchain network
    network.sendCMD(CMD_MAKE_PTX, tx);

    // start mining block
    // miner is user1 (mining reward is given to user1)
    const newBlock= network.blockchain.mingPendingTransactions(user1.getPublic('hex'));

    //ok, new block is mined
    //submit new block and miner info to network
    network.sendCMD(CMD_MAKE_BLOCK, {block, miner: user1.getPublic('hex')});
  }
});
```

After sending new block data and network users are received it, your block will be allowed or disallowed (in case of submiting invalid block).

if allowed, your transaction is confirmed and mining reward is given.

### Customize usage

You can use cnc-blockchain as your own requirements.

Transaction of cnc-blockchain have payload object.

```
//payload structure
{
  "op": "...",
  "data": "..."
}
```

Let's make some simple e-mail application

```
//...
const user1= generateKey();
const user2= generateKey();

const tx= new Transaction(user1.getPublic('hex'), user2.getPublic('hex'), 0);

//add payload
tx.setPayload('message', 'hi there!');

//sign to tx (sender must sign transaction)
tx.signTransaction(user1);
//...
```

This transaction means user1 sends message `hi there!` to user2.

After new block including this transaction is mined, user2 can read `hi there!` message.

You can check this example of e-mail application at [here](http://3.37.53.134:3005/mailbox)

# Tutorial with playground.js for comprehend cnc-blockchain

### Prerequisite for tutorial

1. install [nodejs](https://nodejs.org/ko/)
2. git clone "https://github.com/NamGungGeon/cnc-blockchain" [path_you_want]
3. after moving to [path-you-want] as using `cd` command, write `npm install` or `yarn` into command line for installing required modules.

### <span style="color:#f03c15">Note</span>

Tutorial is executed in nodejs runtime.

For nodejs runtime(not web browser), use `peerjs-nodejs` library instead of `peerjs`.

But `peerjs-nodejs` invoke some exception when connection time is long.

That exception is not thrown in web browser environment, so calm down if exception occur.

### Are you ready?

1. write `node playground.js` or `npm run playground` or `yarn playground`

Now, you can see this in your command line
`insert command (if need help? insert 'help')>>`

As inserting command, you can test cnc-blockchain.

### For example, let's print blockchains

`show blockchain`

```
Blockchain {
  chain: [
    Block {
      timestamp: '2021/09/13',
      transactions: 'GenesisBlock',
      prevHash: '0',
      hash: '75074fabe62ee55ccc14fab905544c1ef750c8c75752763ba534dbba29773312',
      nonce: 0
    }
  ],
  difficulty: 2,
  pendingTransactions: [],
  miningRewrad: 100
}
```

Ok. you can see current blockchain state.

### Let's create keypair(yours) and create new transaction

#### create keypair

`create keypair geon`
this command means 'create new keypair' and labeling it with geon.

label(geon) is optional.

```
insert command (if need help? insert 'help')>>  create keypair geon
new key-pair is generated {
  tag: 'geon',
  publicKey: '04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2',
  privateKey: 'cab7d8893feafc8c9d46d8d2212fe2520a47d72f9e2702f0ef985f9e7da93718'
}
```

publicKey is wallet address.

So, geon's wallet address is `04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2`

#### create transaction (geon send 100 coin to kane)

`create transaction 04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2 kane 100`

this command means `create transaction` from `04f319a3....` to `kane` about `100` coins.

let's type!

```
insert command (if need help? insert 'help')>>  create transaction 04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2 kane 100
???????????? ??? ?????? ?????? ??? ????????????
```

#### Why occur error?

geon's balance is 0.

So `create transaction 04fe19a3... kane 100` is invalid. (if this transaction is valid, geon's balance will be negative after createing transaction)

Therefore, we send 0 coin to kane.

`create transaction 04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2 kane 0`

Result:

```
insert command (if need help? insert 'help')>>  create transaction 04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2 kane 0
transaction is added Transaction {
  fromAddr: '04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2',
  toAddr: 'kane',
  amount: '0',
  data: null,
  signiture: '3045022032b30b2a5983a086f7815a8361c3678b93407359b3400e4e0f5f42d207031767022100e2ab72f64f38f1cf700323daf2ba241f81c1bff330c4de4388f17b1f2b7d5f0d'
}
```

Wow! transaction is created successfully!

But this transaction is pending state, not in blocks.

```
insert command (if need help? insert 'help')>>  show pendingTransactions
[
  Transaction {
    fromAddr: '04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2',
    toAddr: 'kane',
    amount: '0',
    data: null,
    signiture: '3045022032b30b2a5983a086f7815a8361c3678b93407359b3400e4e0f5f42d207031767022100e2ab72f64f38f1cf700323daf2ba241f81c1bff330c4de4388f17b1f2b7d5f0d'
  }
]
insert command (if need help? insert 'help')>>  show blockchain
Blockchain {
  chain: [
    Block {
      timestamp: '2021/09/13',
      transactions: 'GenesisBlock',
      prevHash: '0',
      hash: '75074fabe62ee55ccc14fab905544c1ef750c8c75752763ba534dbba29773312',
      nonce: 0
    }
  ],
  difficulty: 2,
  pendingTransactions: [
    Transaction {
      fromAddr: '04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2',
      toAddr: 'kane',
      amount: '0',
      data: null,
      signiture: '3045022032b30b2a5983a086f7815a8361c3678b93407359b3400e4e0f5f42d207031767022100e2ab72f64f38f1cf700323daf2ba241f81c1bff330c4de4388f17b1f2b7d5f0d'
    }
  ],
  miningRewrad: 100
}
```

For including real-block, let's create(mining) block.

### Let's create(mining) block for moving transactions from pendingTransactions into block

`create block 04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2`

This command means that let's mining block for moving transactions from pendingTransactions into block and miner is `04fe19a3...`.

Mining reward is given to `04fe19a3...`.

```
insert command (if need help? insert 'help')>>  create block 04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2
mining start ( 04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2 )
block is mined 131
ellipsed time 12 ms
```

New block is created(mined).

For creating new block, you do hashing 313 times and ellipsed time is 12ms.

And all of pendingTransactions are moved to real-block.

### Let's check new-block

`show blockchain`

```
Blockchain {
  chain: [
    Block {
      timestamp: '2021/09/13',
      transactions: 'GenesisBlock',
      prevHash: '0',
      hash: '75074fabe62ee55ccc14fab905544c1ef750c8c75752763ba534dbba29773312',
      nonce: 0
    },
    Block {
      timestamp: 1631795341529,
      transactions: [Array],
      prevHash: '75074fabe62ee55ccc14fab905544c1ef750c8c75752763ba534dbba29773312',
      hash: '0041d0d7337125c429c90f234c68587f9bf867b8acbc4a8edb7e35c7a0bad15f',
      nonce: 131
    }
  ],
  difficulty: 2,
  pendingTransactions: [
    Transaction {
      fromAddr: null,
      toAddr: '04fe19a3c8f2be18dce9bdacf8dd6ad8f84bf469231243f6452df14241847221a9fa6431e9d013de29be0815b9af7d93606883ce426c2ea53e45182cb604411ac2',
      amount: 100,
      data: undefined
    }
  ],
  miningRewrad: 100
}

```

Successfully created new Block (timestamp: 1631795341529).

Transaction for rewarding about mining is in pendingTransactions.

This reward is given after next mining is finshed.
