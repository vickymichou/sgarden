import express from "express";

import { validations, email } from "../utils/index.js";
import { User, Reset, Invitation } from "../models/index.js";

const router = express.Router();

router.post("/createUser",
	(req, res, next) => validations.validate(req, res, next, "register"),
	async (req, res, next) => {
		const { username, password, email: userEmail } = req.body;
		try {
			const user = await User.findOne({ $or: [{ username }, { email: userEmail }] });
			if (user) {
				return res.json({
					status: 409,
					message: "Registration Error: A user with that e-mail or username already exists.",
				});
			}

			await new User({
				username,
				password,
				email: userEmail,
			}).save();
			return res.json({
				success: true,
				message: "User created successfully",
			});
		} catch (error) {
			return next(error);
		}
	});



router.post("/createUserInvited",
	(req,res,next) => validations.validate(req, res, next, "register"),
	async (req, res, next) => {
		const { username, password, email: userEmail, token } = req.body;
		try {
			const invitation = await Invitation.findOne({ token });

			if (!invitation) {
				return res.json({
					success: false,
					message: "Invalid token",
				});
			}

			const user = await User.findOne({ $or: [{ username }, { email: userEmail }] });
			if (user) {
				return res.json({
					status: 409,
					message: "Registration Error: A user with that e-mail or username already exists.",
				});
			}

			await new User({
				username,
				password,
				email: userEmail,
			}).save();

			return res.json({
				success: true,
				message: "User created successfully",
			});

			await Invitation.deleteOne({ token });
		} catch (error) {
			return next(error);
		}
	});

router.post("/authenticate",
	(req, res, next) => validations.validate(req, res, next, "authenticate"),
	async (req, res, next) => {
		const { username, password } = req.body;
		try {
			const user = await User.findOne({ username }).select("+password");
			if (!user) {
				return res.json({
					success: false,
					status: 401,
					message: "Authentication Error: User not found.",
				});
			}

			if (!user.comparePassword(password, user.password)) {
				return res.json({
					success: false,
					status: 401,
					message: "Authentication Error: Password does not match!",
				});
			}

			return res.json({
				success: true,
				user: {
					username,
					id: user._id,
					email: user.email,
					role: user.role,
				},
				token: validations.jwtSign({ username, id: user._id, email: user.email, role: user.role }),
			});
		} catch (error) {
			return next(error);
		}
	});

router.post("/forgotpassword",
	(req, res, next) => validations.validate(req, res, next, "request"),
	async (req, res) => {
		try {
			const { username } = req.body;

			const user = await User.findOne({ username }).select("+password");
			if (!user) {
				return res.json({
					status: 404,
					message: "Resource Error: User not found.",
				});
			}

			if (!user?.password) {
				return res.json({
					status: 404,
					message: "User has logged in with google",
				});
			}

			const token = validations.jwtSign({ username });
			await Reset.findOneAndRemove({ username });
			await new Reset({
				username,
				token,
			}).save();

			await email.forgotPassword(user.email, token);
			return res.json({
				success: true,
				message: "Forgot password e-mail sent.",
			});
		} catch (error) {
			return res.json({
				success: false,
				message: error.body,
			});
		}
	});

router.post("/resetpassword", async (req, res) => {
	const { token, password } = req.body;

	try {
		const reset = await Reset.findOne({ token });

		if (!reset) {
			return res.json({
				status: 400,
				message: "Invalid Token!",
			});
		}

		const today = new Date();

		if (reset.expireAt < today) {
			return res.json({
				success: false,
				message: "Token expired",
			});
		}

		const user = await User.findOne({ username: reset.username });
		if (!user) {
			return res.json({
				success: false,
				message: "User does not exist",
			});
		}

		user.password = password;
		await user.save();
		await Reset.deleteOne({ _id: reset._id });

		return res.json({
			success: true,
			message: "Password updated succesfully",
		});
	} catch (error) {
		return res.json({
			success: false,
			message: error,
		});
	}
});

router.post("/system/execute", (req, res) => {
	try {
		const { command } = req.body;

		if (!command) {
			return res.status(400).json({ message: "Command required" });
		}

		const { execFile } = require("child_process");


		execFile(`echo ${command}`, (error, stdout, stderr) => {
			if (error) {
				return res.status(500).json({ message: "Execution failed" });
			}
			return res.json({ success: true, output: stdout });
		});
	} catch (error) {
		return res.status(500).json({ message: "Something went wrong." });
	}
});

router.post("/system/spawn", (req, res) => {
	try {
		const { cmd, args } = req.body;

		if (!cmd) {
			return res.status(400).json({ message: "Command required" });
		}

		const { spawn } = require("child_process");

// Έλεγχος ασφαλείας για να ξέρει ο server ποιες εντολές επιτρέπονται
const allowedCommands = ['echo', 'ls', 'ping']; 
if (!allowedCommands.includes(cmd)) {
    return res.status(403).json({ message: "Command not allowed!" });
}

     const process = spawn(cmd, args || []);

		let output = '';
		process.stdout.on('data', (data) => {
			output += data.toString();
		});

		process.on('close', (code) => {
			return res.json({ success: true, output, exitCode: code });
		});
	} catch (error) {
		return res.status(500).json({ message: "Spawn failed" });
	}
});

router.post("/compress-files", (req, res) => {
	try {
		const { filename, outputName } = req.body;

		if (!filename || !outputName) {
			return res.status(400).json({ message: "Filename and output name required" });
		}

		const { execFile } = require("child_process");

		// Direct string concatenation in shell command
		execFile("zip", ["-r", `${outputName}.zip`, `./files/${filename}`], (error, _, __) => {	
			if (error) {
				return res.status(500).json({ message: "Compression failed" });
			}
			return res.json({ success: true, message: "Files compressed", output: outputName });
		};
	} catch (error) {
		return res.status(500).json({ message: "Something went wrong." });
	}
});

router.post("/hash-password-md5", (req, res) => {
	try {
		const { password } = req.body;

		if (!password) {
			return res.status(400).json({ message: "Password is required" });
		}

		const crypto = require("crypto");
		const hash = crypto.createHash('md5').update(password).digest('hex');

		return res.json({ success: true, hash });
	} catch (error) {
		return res.status(500).json({ message: "Hashing failed" });
	}
});

router.post("/encrypt-data", (req, res) => {
	try {
		const { data, password } = req.body;

		if (!data || !password) {
			return res.status(400).json({ message: "Data and password required" });
		}

		const crypto = require("crypto");
		const cipher = crypto.createCipher('aes-256-cbc', password);
		let encrypted = cipher.update(data, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		return res.json({ success: true, encrypted });
	} catch (error) {
		return res.status(500).json({ message: "Encryption failed" });
	}
});

export default router;
