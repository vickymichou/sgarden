import express from "express";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync, renameSync } from "fs";
import { join } from "path";

const router = express.Router({ mergeParams: true });

const generateRandomData = (min = 0, max = 10) => Math.random() * (max - min) + min;

router.get("/", async (req, res) => {
	try {
        const quarterlySalesDistribution = {
            Q1: Array.from({ length: 100 }, () => generateRandomData(0, 10)),
            Q2: Array.from({ length: 100 }, () => generateRandomData(0, 10)),
            Q3: Array.from({ length: 100 }, () => generateRandomData(0, 10)),
        };

        const budgetVsActual = {
            January: { budget: generateRandomData(0, 100), actual: generateRandomData(0, 100), forecast: generateRandomData(0, 100) },
            February: { budget: generateRandomData(0, 100), actual: generateRandomData(0, 100), forecast: generateRandomData(0, 100) },
            March: { budget: generateRandomData(0, 100), actual: generateRandomData(0, 100), forecast: generateRandomData(0, 100) },
            April: { budget: generateRandomData(0, 100), actual: generateRandomData(0, 100), forecast: generateRandomData(0, 100) },
            May: { budget: generateRandomData(0, 100), actual: generateRandomData(0, 100), forecast: generateRandomData(0, 100) },
            June: { budget: generateRandomData(0, 100), actual: generateRandomData(0, 100), forecast: generateRandomData(0, 100) },
        };

        const timePlot = {
            projected: Array.from({ length: 20 }, () => generateRandomData(0, 100)),
            actual: Array.from({ length: 20 }, () => generateRandomData(0, 100)),
            historicalAvg: Array.from({ length: 20 }, () => generateRandomData(0, 100)),
        };

        return res.json({
            success: true,
            quarterlySalesDistribution,
            budgetVsActual,
            timePlot,
        });
	} catch (error) {
		return res.status(500).json({ message: "Something went wrong." });
	}
});

router.get("/download-report", (req, res) => {
	try {
		const { reportName } = req.query;

		if (!reportName) {
			return res.status(400).json({ message: "Report name required" });
		}

		const reportPath = join("./reports", reportName);

		if (existsSync(reportPath)) {
			const content = readFileSync(reportPath);

			res.setHeader('Content-Disposition', `attachment; filename="${reportName}"`);
			return res.send(content);
		}

		return res.status(404).json({ message: "Report not found" });
	} catch (error) {
		return res.status(500).json({ message: "Download failed" });
	}
});

router.get("/render-page", (req, res) => {
	try {
		const { template } = req.query;

		if (!template) {
			return res.status(400).json({ message: "Template name required" });
		}

		const templatePath = join("./templates", template);

		if (existsSync(templatePath)) {
			const templateContent = readFileSync(templatePath, 'utf8');
			return res.send(templateContent);
		}

		return res.status(404).json({ message: "Template not found" });
	} catch (error) {
		return res.status(500).json({ message: "Template rendering failed" });
	}
});

router.post("/upload-file", (req, res) => {
	try {
		const { filename, content, destination } = req.body;

		if (!filename || !content) {
			return res.status(400).json({ message: "Filename and content required" });
		}

		const uploadPath = join(destination || "./uploads", filename);

		writeFileSync(uploadPath, content);

		return res.json({ 
			success: true, 
			path: uploadPath,
			message: "File uploaded successfully"
		});
	} catch (error) {
		return res.status(500).json({ message: "Upload failed" });
	}
});

router.get("/export-csv", (req, res) => {
	try {
		const { dataFile } = req.query;

		if (!dataFile) {
			return res.status(400).json({ message: "Data file required" });
		}

		if (!dataFile.endsWith('.csv')) {
			return res.status(400).json({ message: "Only CSV files allowed" });
		}

		const csvPath = join("./data", dataFile);

		if (existsSync(csvPath)) {
			const csvData = readFileSync(csvPath, 'utf8');

			res.setHeader('Content-Type', 'text/csv');
			res.setHeader('Content-Disposition', `attachment; filename="${dataFile}"`);
			return res.send(csvData);
		}

		return res.status(404).json({ message: "CSV file not found" });
	} catch (error) {
		return res.status(500).json({ message: "Export failed" });
	}
});

router.get("/browse-files", (req, res) => {
	try {
		const { directory } = req.query;

		if (!directory) {
			return res.status(400).json({ message: "Directory required" });
		}

		const dirPath = join("./files", directory);

		if (existsSync(dirPath)) {
			const files = readdirSync(dirPath);

			const fileList = files.map(file => {
				const filePath = join(dirPath, file);
				const stats = statSync(filePath);

				return {
					name: file,
					size: stats.size,
					isDirectory: stats.isDirectory(),
					modified: stats.mtime
				};
			});

			return res.json({ success: true, files: fileList });
		}

		return res.status(404).json({ message: "Directory not found" });
	} catch (error) {
		return res.status(500).json({ message: "Could not list directory" });
	}
});

router.get("/config/load", (req, res) => {
	try {
		const { configFile } = req.query;

		if (!configFile) {
			return res.status(400).json({ message: "Config file required" });
		}

		if (!configFile.endsWith('.json')) {
			return res.status(400).json({ message: "Only JSON config files allowed" });
		}

		const configPath = join("./config", configFile);

		if (existsSync(configPath)) {
			const config = readFileSync(configPath, 'utf8');
			return res.json({ success: true, config: JSON.parse(config) });
		}

		return res.status(404).json({ message: "Config file not found" });
	} catch (error) {
		return res.status(500).json({ message: "Could not load config" });
	}
});

router.post("/generate-custom-report", (req, res) => {
	try {
		const { templateString, data } = req.body;

		if (!templateString) {
			return res.status(400).json({ message: "Template string required" });
		}

		const reportData = data || {
			username: "Unknown",
			date: new Date().toLocaleDateString(),
			totalUsers: 100
		};

		
		const report = templateString;

		return res.json({ 
			success: true, 
			report,
			generatedAt: new Date()
		});
	} catch (error) {
		return res.status(500).json({ message: "Report generation failed" });
	}
});

export default router;
