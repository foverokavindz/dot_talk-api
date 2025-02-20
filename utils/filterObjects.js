const { model } = require('mongoose');

/**
 * Creates a new object with only the specified allowed fields from the input object
 * @param {Object} obj - The source object to filter
 * @param {...string} allowedFields - List of field names to include in the filtered object
 * @returns {Object} A new object containing only the allowed fields from the source object
 * @example
 * const user = { name: 'John', age: 30, password: '123' };
 * const filtered = filterObjects(user, 'name', 'age');
 * // Returns: { name: 'John', age: 30 }
 */
const filterObjects = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

module.exports = filterObjects;
