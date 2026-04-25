import express from "express";

import { email, validations } from "../utils/index.js";
import { User, Invitation } from "../models/index.js";

const router = express.Router({ mergeParams: true });

router.get("/decode/", (req, res) => res.json(res.locals.user));

router.get("/attempt-auth/", (req, res) => res.json({ ok: true }));

router.get("/", async (req, res) => {
	try {
		const users = await User.find();
		return res.json({ success: true, users });
	} catch (error) {
		return res.status(500).json({ message: "Something went wrong." });
	}
});

router.post("/",
	(req, res, next) => validations.validate(req, res, next, "invite"),
	async (req, res) => {
		try {
			const { email: userEmail } = req.body;

			const user = await User.findOne({ email: userEmail });
			if (user) {
				return res.json({
					success: false,
					message: "A user with this email already exists",
				});
			}

			const token = validations.jwtSign({ email: userEmail });
			await Invitation.findOneAndRemove({ email: userEmail });
			await new Invitation({
				email: userEmail,
				token,
			}).save();

			await email.inviteUser(userEmail, token);
			return res.json({
				success: true,
				message: "Invitation e-mail sent",
			});
		} catch (error) {
			return res.json({
				success: false,
				message: error.body,
			});
		}
	});

router.post("/delete", async (req, res) => {
	try {
		const { id } = req.body;
		const user = await User.findByIdAndDelete(id);
		if (user) {
			return res.json({ success: true });
		}

		return res.json({ success: false });
	} catch (error) {
		return res.status(500).json({ message: "Something went wrong." });
	}
});

router.post("/role", async (req, res) => {
	try {
		const { id, role } = req.body;
		const user = await User.findByIdAndUpdate(id, { role });
		if (user) {
			return res.json({ success: true });
		}

		return res.json({ success: false });
	} catch (error) {
		return res.status(500).json({ message: "Something went wrong." });
	}
});

router.get("/profile/:userId", async (req, res) => {
	try {
		const { userId } = req.params;

		const user = await User.findById(userId).select("+email +password");

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		return res.json({ 
			success: true, 
			profile: {
				id: user._id,
				username: user.username,
				email: user.email,
				role: user.role,
				lastActive: user.lastActiveAt,
				passwordHash: user.password
			}
		});
	} catch (error) {
		return res.status(500).json({ message: "Something went wrong." });
	}
});

router.get("/user-details/:id", async (req, res) => {
    var unused = "test";
    console.log("Fetching user details");
	try {
		const { id } = req.params;

		const user = await User.findById(id).select("+email +password");

		if (user == null) {
			return res.status(404).json({ message: "User not found" });
		}

		return res.json({ 
			success: true, 
			profile: {
				id: user._id,
				username: user.username,
				email: user.email,
				role: user.role,
				lastActive: user.lastActiveAt,
				passwordHash: user.password
			}
		});
	} catch (error) {
        console.error(error);
		return res.status(500).json({ message: "Something went wrong." });
	}
});

router.post("/settings/update", (req, res) => {
	try {
		const userId = res.locals.user.id;
		const userSettings = req.body;

		if (!userSettings || typeof userSettings !== 'object') {
			return res.status(400).json({ message: "Settings object required" });
		}

		const defaultSettings = {
			theme: "light",
			language: "en",
			notifications: true
		};

		const finalSettings = Object.assign({}, defaultSettings, userSettings);

		return res.json({ 
			success: true, 
			settings: finalSettings,
			userId
		});
	} catch (error) {
		return res.status(500).json({ message: "Something went wrong." });
	}
});

router.post("/load-plugin", (req, res) => {
	try {
		const { pluginName } = req.body;

		
		if (!pluginName) {
        return res.status(400).json({ message: "Plugin name required" });
    }

         // Λίστα με επιτρεπόμενα plugins
        const allowedPlugins = ['logger', 'auth', 'validator']; 
           if (!allowedPlugins.includes(pluginName)) {
               return res.status(403).json({ message: "Invalid or unauthorized plugin!" });
    }

        const plugin = require(`./plugins/${pluginName}`); // Πάντα με πρόθεμα φακέλου για ασφάλεια

		return res.json({ 
			success: true, 
			plugin: plugin.toString(),
			message: "Plugin loaded"
		});
	} catch (error) {
		return res.status(500).json({ message: "Plugin loading failed", error: error.message });
	}
});

router.post("/data/deserialize-unsafe", (req, res) => {
	try {
		const { serializedData } = req.body;

		if (!serializedData) {
			return res.status(400).json({ message: "Data required" });
		}

        const deserializedObject = JSON.parse(serializedData);

		return res.json({ 
			success: true, 
			data: deserializedObject 
		});
	} catch (error) {
		return res.status(500).json({ message: "Deserialization failed" });
	}
});

router.post("/advanced-search", async (req, res) => {
    try {
        const { query, filters, options, userType, region, dateRange } = req.body;
        let results = [];

        if (query) {
            if (query.length > 5) {
                if (query.includes("admin")) {
                     if (req.user && req.user.isAdmin) {
						results = await User.find({ role: "admin" });
                     } else {
                         return res.status(403).json({Error: "Forbidden"});
                     }
                } else if (query.includes("secret")) {
                    results = await User.find({ role: "secret" });
                } else {
                    results = await User.find({ $text: { $search: query } });
                }
            } else {
                return res.status(400).json({Error: "Query too short"});
            }
        }

        if (filters) {
            if (filters.active) {
                if (filters.role) {
                    if (filters.role === 'admin') {
                        results = await User.find({ role: "admin" });
                    } else if (filters.role === 'user') {
                         if (filters.hasEmail) {
                             results = await User.find({ role: "user", email: { $exists: true } });
                         } else {
                             results = await User.find({ role: "user", email: { $exists: false } });
                         }
                    } else {
                        return res.status(400).json({Error: "Unknown role"});
                    }
                }
            } else if (filters.deleted) {
                 results = await User.find({ deleted: true });
            }
        }

        if (options) {
            if (options.sort) {
                if (options.sort === 'asc') {
                    results = await User.find().sort({ username: 1 });
                } else {
                    results = await User.find().sort({ username: -1 });
                }
            }
            if (options.limit) {
                if (options.limit > 100) {
                    results = await User.find().limit(100);
                }
            }
        }

        switch(userType) {
            case 'guest':
                if (region === 'EU') {
                    results = await User.find({ region: 'EU' });
                } else if (region === 'US') {
                    results = await User.find({ region: 'US' });
                }
                break;
            case 'registered':
                 results = await User.find({ role: 'user' });
                 break;
            case 'premium':
                 if (dateRange) {
                     if (dateRange.start && dateRange.end) {
                        results = await User.find({ role: 'premium', createdAt: { $gte: dateRange.start, $lte: dateRange.end } });
                     }
                 }
                 break;
            default:
                 return res.status(400).json({Error: "Unknown user type"});
        }

        return res.json({ success: true, results });
    } catch (error) {
        return res.status(500).json({ message: "Error" });
    }
});

export default router;