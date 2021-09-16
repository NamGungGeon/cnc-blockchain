const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

module.exports = {
  generateKey: () => {
    const key = ec.genKeyPair();
    const publicKey = key.getPublic("hex");
    const privateKey = key.getPrivate("hex");
    console.log("\nKey Pair is generated =====");
    console.log("Public Key:", publicKey);
    console.log("Private Key:", privateKey);
    console.log("===========================");

    return [publicKey, privateKey, key];
  },
};
