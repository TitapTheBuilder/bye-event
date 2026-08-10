const { hashSync } = require('@node-rs/argon2'); console.log(hashSync('password123', { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 }));
