const userIds = Array.from({ length: 1000 }, (_, index) => `user_${String(index + 1).padStart(4, '0')}`);

module.exports = {
  userIds
};
