const rand = () => {
   return Math.random().toString(36).substr(2);
};

const generateToken = () => {
   return rand() + rand() + rand() + rand();
};

module.exports = { generateToken };
