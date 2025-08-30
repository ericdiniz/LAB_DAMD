class User {
  constructor({ id, email, username, passwordHash, firstName, lastName, createdAt }) {
    this.id = id;
    this.email = email;
    this.username = username;
    this.passwordHash = passwordHash;
    this.firstName = firstName;
    this.lastName = lastName;
    this.createdAt = createdAt || new Date().toISOString();
  }
}
module.exports = User;
