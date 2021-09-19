const readline = require("readline");
const { Blockchain, Transaction } = require("./blockchain");
const { generateKey, keys } = require("./keygen");
const fs = require("fs");
const wallets = require("./wallets");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const helpMsg = `
command list ========

!!!!!!!!!!!!!! show !!!!!!!!!!!!!!
1. show blockchain
>> show all blocks in blockchain

2. show pendingTransactions
>> show all pending transactions

3. show block [index]
>> show selected index block
>> ex: show block 1 
>> ex: show 1 index block

4. show keychain
>> show all created keypairs with label

!!!!!!!!!!!!!! create !!!!!!!!!!!!!!
1. create keypair [label]
>> create new keypair with label
>> label is optional

2. create transaction [fromAddr] [toAddr] [amount] [filePath]
>> create transaction
>> if filePath is exist, read target file and include that file contents
>> filePath is optional

3. create block [minerAddr]
>> create(mining) block made of pendingTransactions

=====================
`;

const cncCoin = new Blockchain();
const execCmd = (callback) => {
  rl.question("insert command (if need help? insert 'help')>>  ", (input) => {
    try {
      const cmds = input.split(" ");
      const target = cmds[1];
      switch (cmds[0]) {
        case "show":
          if (target === "blockchain") {
            console.log(cncCoin);
          } else if (target === "block") {
            const index = parseInt(cmds[2]);
            if (isNaN(index)) {
              console.error("index must be integer");
            } else if (index >= cncCoin.chain.length) {
              console.error("index must be smaller than", cncCoin.chain.length);
            } else {
              console.log("Block", index, cncCoin.chain[index]);
            }
          } else if (target === "pendingTransactions") {
            console.log(cncCoin.pendingTransactions);
          } else if (target === "keychain") {
            console.log(keys);
          } else {
            console.error("invalid target");
          }
          break;
        case "create":
          if (target === "keypair") {
            const tag = cmds[2];
            const kp = generateKey(tag);
            console.log("new key-pair is generated", {
              tag,
              publicKey: kp[0],
              privateKey: kp[1],
            });
          } else if (target === "transaction") {
            const [fromAddr, toAddr, amount, filePath] = cmds.slice(2);
            const fromAddrPrivateKey = keys.find(
              (k) => k.publicKey === fromAddr
            )?.privateKey;
            if (!fromAddrPrivateKey) {
              console.error("fromAddr is must be in keychains");
              console.error('recheck keychain using "show keychain"');
              break;
            }
            const fromAddrKeyPair = ec.keyFromPrivate(fromAddrPrivateKey);
            const tx = new Transaction(
              fromAddr,
              toAddr,
              amount,
              filePath || null
            );
            tx.signTransaction(fromAddrKeyPair);
            cncCoin.addTransaction(tx);
            console.log("transaction is added", tx);
          } else if (target === "block") {
            const fromAddr = cmds[2];
            if (!fromAddr) {
              console.error("fromAddr is undefined");
              console.error("must insert miner wallet address");
              break;
            }
            console.log("mining start (", fromAddr, ")");
            cncCoin.minePendingTransactions(fromAddr);

            console.log("mining end...");
          }
          break;
        case "help":
          console.log(helpMsg, "\n\n");
          break;
        default:
          console.log("unknown command");
          console.log(helpMsg, "\n\n");
      }
    } catch (e) {
      console.error(e);
    }

    callback();
  });
};

const callback = () => {
  execCmd(callback);
};
callback();
