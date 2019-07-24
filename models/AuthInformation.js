const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  id: String,
  auth: Object,
});

// Ensures unecessary information is not made visible when docs are queried
permissionSchema.set('toJSON', {
	transform: (doc, returnedObj) => {
		delete returnedObj._id;
		delete returnedObj.__v;
	},
});

const AuthInformation = mongoose.model('AuthInformation', permissionSchema);

module.exports = AuthInformation;
