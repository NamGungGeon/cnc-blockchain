/**
 * keygen.js can generate private-public key pair
 * Public key pair is wallet addreess
 *
 * @Usage
 * const {generateKey}= require('[path]/keygen');
 * const [walletAddr, privateKey, key]= generateKey();
 */

const { ec: EC } = require("elliptic");
const ec = new EC("secp256k1");

const keys = [];
module.exports = {
  generateKey: (tag) => {
    const key = ec.genKeyPair();
    const publicKey = key.getPublic("hex");
    const privateKey = key.getPrivate("hex");
    // console.log("\nKey Pair is generated", tag ? `(${tag})` : "", "=====");
    // console.log("Public Key:", publicKey);
    // console.log("Private Key:", privateKey);
    // console.log("===========================");

    keys.push({ tag, publicKey, privateKey });

    return key;
  },
  fromPrivateKey: (privateKey) => {
    return ec.keyFromPrivate(privateKey);
  },
  keys,
};
