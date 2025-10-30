const { v4: uuidv4 } = require('uuid');

// In-memory database
const database = {
  users: [
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@college.com',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      role: 'admin',
      createdAt: new Date()
    },
    {
      id: '2',
      name: 'John Mentor',
      email: 'mentor@college.com',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      role: 'mentor',
      createdAt: new Date()
    },
    {
      id: '3',
      name: 'Jane Warden',
      email: 'warden@college.com',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      role: 'warden',
      createdAt: new Date()
    },
    {
      id: '4',
      name: 'Parent User',
      email: 'parent@example.com',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      role: 'parent',
      studentName: 'Student Name',
      studentId: 'STU001',
      contactNumber: '9876543210',
      createdAt: new Date()
    }
  ],
  outpasses: [],
  nextOutpassId: 1
};

// Helper functions
const findUserByEmail = (email) => {
  return database.users.find(user => user.email === email);
};

const findUserById = (id) => {
  return database.users.find(user => user.id === id);
};

const createUser = (userData) => {
  const user = {
    id: uuidv4(),
    ...userData,
    createdAt: new Date()
  };
  database.users.push(user);
  return user;
};

const createOutpass = (outpassData) => {
  const outpass = {
    id: database.nextOutpassId++,
    ...outpassData,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  database.outpasses.push(outpass);
  return outpass;
};

const findOutpassById = (id) => {
  return database.outpasses.find(outpass => outpass.id === parseInt(id));
};

const updateOutpass = (id, updates) => {
  const index = database.outpasses.findIndex(outpass => outpass.id === parseInt(id));
  if (index !== -1) {
    database.outpasses[index] = {
      ...database.outpasses[index],
      ...updates,
      updatedAt: new Date()
    };
    return database.outpasses[index];
  }
  return null;
};

const getOutpassesByUser = (userId) => {
  return database.outpasses.filter(outpass => outpass.createdBy === userId);
};

const getAllOutpasses = () => {
  return database.outpasses;
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  createOutpass,
  findOutpassById,
  updateOutpass,
  getOutpassesByUser,
  getAllOutpasses
};