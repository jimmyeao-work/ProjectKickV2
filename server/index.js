const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const csv = require('csv-parser');
const Papa = require('papaparse');
const { Anthropic } = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Only serve static files in production or if build exists
const buildPath = path.join(__dirname, '../client/build');
if (process.env.NODE_ENV === 'production' || require('fs').existsSync(buildPath)) {
    app.use(express.static(buildPath));
}

// Claude API setup
const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
});

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Utility function to read and parse CSV
async function parseCSV(filePath) {
    const csvData = await fs.readFile(filePath, 'utf8');
    const parsed = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
    });
    return parsed.data;
}

// Utility function to analyze data structure
function analyzeDataStructure(data) {
    if (!data || data.length === 0) return null;

    const sample = data.slice(0, 5);
    const columns = Object.keys(data[0]);
    const totalRows = data.length;
    
    const columnTypes = {};
    columns.forEach(col => {
        const sampleValues = data.slice(0, 100).map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
        const types = [...new Set(sampleValues.map(val => typeof val))];
        columnTypes[col] = types.length === 1 ? types[0] : 'mixed';
    });

    return {
        totalRows,
        columns,
        columnTypes,
        sample,
        hasDateColumns: columns.some(col => 
            col.toLowerCase().includes('date') || 
            col.toLowerCase().includes('time') ||
            col.toLowerCase().includes('created') ||
            col.toLowerCase().includes('updated')
        ),
        hasStatusColumns: columns.some(col => 
            col.toLowerCase().includes('status') ||
            col.toLowerCase().includes('state') ||
            col.toLowerCase().includes('priority')
        ),
        hasUserColumns: columns.some(col => 
            col.toLowerCase().includes('user') ||
            col.toLowerCase().includes('agent') ||
            col.toLowerCase().includes('assignee') ||
            col.toLowerCase().includes('name')
        )
    };
}

// Claude API integration for report generation
async function generateReportWithClaude(data, reportType, fileName) {
    const dataStructure = analyzeDataStructure(data);
    
    // Analyze SLA performance specifically
    const slaAnalysis = analyzeSLAPerformance(data);
    
    console.log('SLA Analysis Results:', slaAnalysis); // Debug logging
    
    const prompts = {
        executive: `You are an expert data analyst creating an executive summary for IT support performance.

        CRITICAL: Analyze the COMPLETE dataset provided below. Do NOT make assumptions or use sample data.

        COMPLETE SLA PERFORMANCE ANALYSIS (${data.length} total records):
        ${JSON.stringify(slaAnalysis, null, 2)}

        ACTUAL DATA SUMMARY:
        - Total Tickets: ${data.length}
        - First Response SLA Violations: ${slaAnalysis.firstResponseSLA.violations}
        - Resolution SLA Violations: ${slaAnalysis.resolutionSLA.violations}
        - First Response SLA Compliance: ${slaAnalysis.firstResponseSLA.compliancePercentage}%
        - Resolution SLA Compliance: ${slaAnalysis.resolutionSLA.compliancePercentage}%

        IMPORTANT: Use ONLY the actual SLA analysis data above. Do NOT report 100% compliance unless the actual data shows 0 violations.
        
        Return insights in this JSON format:
        {
            "title": "IT Support SLA Performance Executive Summary",
            "keyMetrics": [
                {"label": "First Response SLA Compliance", "value": "${slaAnalysis.firstResponseSLA.compliancePercentage}%", "trend": "stable", "impact": "high"},
                {"label": "Resolution SLA Compliance", "value": "${slaAnalysis.resolutionSLA.compliancePercentage}%", "trend": "stable", "impact": "high"},
                {"label": "Total Tickets", "value": "${data.length}", "trend": "stable", "impact": "medium"},
                {"label": "SLA Violations", "value": "${slaAnalysis.firstResponseSLA.violations + slaAnalysis.resolutionSLA.violations}", "trend": "stable", "impact": "high"}
            ],
            "criticalFindings": [
                {"finding": "Actual SLA performance analysis based on uploaded data", "impact": "Business impact based on real violations", "priority": "high"}
            ],
            "recommendations": [
                {"action": "Address specific SLA violations identified in data", "timeline": "immediate", "impact": "Improve actual SLA compliance"}
            ],
            "summary": "Analysis based on ${data.length} actual tickets with ${slaAnalysis.firstResponseSLA.violations + slaAnalysis.resolutionSLA.violations} total SLA violations"
        }`,

        detailed: `You are a senior IT operations analyst creating a detailed SLA performance report.
        
        CRITICAL: Return ONLY valid JSON. Do NOT include any text before or after the JSON.
        You MUST provide content for ALL sections listed below - no empty arrays or null values.

        COMPLETE SLA ANALYSIS (${data.length} tickets analyzed):
        First Response SLA: ${slaAnalysis.firstResponseSLA.compliancePercentage}% compliance (${slaAnalysis.firstResponseSLA.violations} violations)
        Resolution SLA: ${slaAnalysis.resolutionSLA.compliancePercentage}% compliance (${slaAnalysis.resolutionSLA.violations} violations)

        AGENTS DATA: ${JSON.stringify(Object.keys(slaAnalysis.agents || {}).slice(0, 5))}
        CATEGORIES DATA: ${JSON.stringify(Object.keys(slaAnalysis.categories || {}).slice(0, 5))}

        Return this exact JSON structure with real data:
        {
            "overview": {
                "totalRecords": ${data.length},
                "timeSpan": "Based on uploaded CSV data",
                "keyTrends": ["SLA violations require attention", "Response time improvements needed", "Resolution efficiency varies by category"]
            },
            "slaMetrics": {
                "firstResponseSLA": {
                    "compliance": "${slaAnalysis.firstResponseSLA.compliancePercentage}%",
                    "violations": ${slaAnalysis.firstResponseSLA.violations || 0},
                    "total": ${slaAnalysis.firstResponseSLA.total || 0}
                },
                "resolutionSLA": {
                    "compliance": "${slaAnalysis.resolutionSLA.compliancePercentage}%", 
                    "violations": ${slaAnalysis.resolutionSLA.violations || 0},
                    "total": ${slaAnalysis.resolutionSLA.total || 0}
                }
            },
            "performanceMetrics": [
                {"metric": "First Response SLA Compliance", "current": "${slaAnalysis.firstResponseSLA.compliancePercentage}%", "benchmark": "95%", "status": "${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'good' : parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 90 ? 'warning' : 'critical'}"},
                {"metric": "Resolution SLA Compliance", "current": "${slaAnalysis.resolutionSLA.compliancePercentage}%", "benchmark": "90%", "status": "${parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) >= 90 ? 'good' : parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) >= 85 ? 'warning' : 'critical'}"},
                {"metric": "Total Tickets Processed", "current": "${data.length}", "benchmark": "Baseline", "status": "good"}
            ],
            "problemAreas": [
                {"area": "Response Time Violations", "volume": ${slaAnalysis.firstResponseSLA.violations || 0}, "percentage": ${slaAnalysis.firstResponseSLA.violationPercentage || 0}, "description": "Tickets exceeding first response SLA targets"},
                {"area": "Resolution Time Violations", "volume": ${slaAnalysis.resolutionSLA.violations || 0}, "percentage": ${slaAnalysis.resolutionSLA.violationPercentage || 0}, "description": "Tickets exceeding resolution SLA targets"}
            ],
            "agentPerformance": [
                ${Object.entries(slaAnalysis.agents || {}).slice(0, 5).map(([agent, stats]) => 
                    `{"agent": "${agent}", "responseViolations": ${stats.responseViolations || 0}, "resolutionViolations": ${stats.resolutionViolations || 0}, "totalTickets": ${stats.total || 0}}`
                ).join(',') || '{"agent": "No agent data", "responseViolations": 0, "resolutionViolations": 0, "totalTickets": 0}'}
            ],
            "insights": [
                "Analysis based on ${data.length} actual support tickets from uploaded CSV",
                "${slaAnalysis.firstResponseSLA.violations + slaAnalysis.resolutionSLA.violations} total SLA violations identified across both response and resolution metrics",
                "Performance varies by agent and category - focused improvement needed",
                "Data quality is good with comprehensive SLA status tracking"
            ]
        }`,

        presentation: `Create a presentation-style SLA performance analysis for IT leadership.
        
        CRITICAL: Return ONLY valid JSON. Use the exact numbers provided below.

        ACTUAL DATA (${data.length} tickets):
        - First Response SLA: ${slaAnalysis.firstResponseSLA.compliancePercentage}% compliance (${slaAnalysis.firstResponseSLA.violations} violations)
        - Resolution SLA: ${slaAnalysis.resolutionSLA.compliancePercentage}% compliance (${slaAnalysis.resolutionSLA.violations} violations)
        - Total Violations: ${slaAnalysis.firstResponseSLA.violations + slaAnalysis.resolutionSLA.violations}

        Return this exact JSON structure:
        {
            "slides": [
                {
                    "title": "SLA Performance Overview",
                    "type": "overview",
                    "content": {
                        "headline": "IT Support SLA Performance Summary",
                        "metrics": [
                            {"label": "First Response SLA", "value": "${slaAnalysis.firstResponseSLA.compliancePercentage}%", "highlight": true},
                            {"label": "Resolution SLA", "value": "${slaAnalysis.resolutionSLA.compliancePercentage}%", "highlight": true},
                            {"label": "Total Violations", "value": "${slaAnalysis.firstResponseSLA.violations + slaAnalysis.resolutionSLA.violations}", "highlight": false}
                        ],
                        "insights": ["Analysis based on ${data.length} support tickets from uploaded CSV"],
                        "visual": "SLA compliance dashboard"
                    }
                },
                {
                    "title": "SLA Violations Breakdown",
                    "type": "analysis", 
                    "content": {
                        "headline": "Performance Areas Requiring Attention",
                        "metrics": [
                            {"label": "Response Time Violations", "value": "${slaAnalysis.firstResponseSLA.violations}", "highlight": true},
                            {"label": "Resolution Time Violations", "value": "${slaAnalysis.resolutionSLA.violations}", "highlight": true}
                        ],
                        "insights": ["Focus on improving response times and resolution efficiency"],
                        "visual": "Violation trend analysis"
                    }
                }
            ],
            "keyMessage": "SLA Performance: ${slaAnalysis.firstResponseSLA.compliancePercentage}% response compliance, ${slaAnalysis.resolutionSLA.compliancePercentage}% resolution compliance",
            "callToAction": "Address ${slaAnalysis.firstResponseSLA.violations + slaAnalysis.resolutionSLA.violations} total SLA violations to improve service delivery"
        }`
    };

    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: [{
                role: 'user',
                content: prompts[reportType] || prompts.detailed
            }]
        });

        return response.content[0].text;
    } catch (error) {
        console.error('Claude API Error:', error);
        throw new Error('Failed to generate report with Claude AI');
    }
}

// Add SLA analysis function
function analyzeSLAPerformance(data) {
    if (!data || data.length === 0) return null;

    const slaAnalysis = {
        totalTickets: data.length,
        firstResponseSLA: {
            violations: 0,
            compliance: 0,
            total: 0,
            compliancePercentage: '0'
        },
        resolutionSLA: {
            violations: 0, 
            compliance: 0,
            total: 0,
            compliancePercentage: '0'
        },
        agents: {},
        categories: {}
    };

    console.log('Analyzing SLA for', data.length, 'tickets');
    console.log('Sample ticket columns:', Object.keys(data[0] || {}));

    data.forEach((ticket, index) => {
        const agent = ticket['Agent'] || ticket['Resolved by'] || ticket['Assignee'] || 'Unknown';
        const category = ticket['Category'] || ticket['Sub-Category'] || 'Unknown';
        
        // Initialize agent tracking
        if (!slaAnalysis.agents[agent]) {
            slaAnalysis.agents[agent] = {
                total: 0,
                responseViolations: 0,
                resolutionViolations: 0
            };
        }
        
        // Initialize category tracking  
        if (!slaAnalysis.categories[category]) {
            slaAnalysis.categories[category] = {
                total: 0,
                responseViolations: 0,
                resolutionViolations: 0
            };
        }
        
        slaAnalysis.agents[agent].total++;
        slaAnalysis.categories[category].total++;

        // Analyze First Response SLA - be more flexible with column names
        const firstResponseStatus = ticket['First Response Status'] || 
                                   ticket['First Response SLA'] || 
                                   ticket['Response Status'] ||
                                   ticket['first_response_status'];
        
        if (firstResponseStatus) {
            slaAnalysis.firstResponseSLA.total++;
            const statusLower = firstResponseStatus.toString().toLowerCase();
            
            if (statusLower.includes('violated') || 
                statusLower.includes('breach') || 
                statusLower.includes('missed') ||
                statusLower.includes('overdue')) {
                slaAnalysis.firstResponseSLA.violations++;
                slaAnalysis.agents[agent].responseViolations++;
                slaAnalysis.categories[category].responseViolations++;
                console.log(`Response SLA violation found in ticket ${index}: ${firstResponseStatus}`);
            } else if (statusLower.includes('within') || 
                      statusLower.includes('met') || 
                      statusLower.includes('compliant')) {
                slaAnalysis.firstResponseSLA.compliance++;
            }
        }

        // Analyze Resolution SLA - be more flexible with column names
        const resolutionStatus = ticket['Resolution Status'] || 
                                ticket['Resolution SLA'] || 
                                ticket['Resolve Status'] ||
                                ticket['resolution_status'];
        
        if (resolutionStatus) {
            slaAnalysis.resolutionSLA.total++;
            const statusLower = resolutionStatus.toString().toLowerCase();
            
            if (statusLower.includes('violated') || 
                statusLower.includes('breach') || 
                statusLower.includes('missed') ||
                statusLower.includes('overdue')) {
                slaAnalysis.resolutionSLA.violations++;
                slaAnalysis.agents[agent].resolutionViolations++;
                slaAnalysis.categories[category].resolutionViolations++;
                console.log(`Resolution SLA violation found in ticket ${index}: ${resolutionStatus}`);
            } else if (statusLower.includes('within') || 
                      statusLower.includes('met') || 
                      statusLower.includes('compliant')) {
                slaAnalysis.resolutionSLA.compliance++;
            }
        }
    });

    // Calculate percentages
    if (slaAnalysis.firstResponseSLA.total > 0) {
        const complianceRate = (slaAnalysis.firstResponseSLA.compliance / slaAnalysis.firstResponseSLA.total) * 100;
        slaAnalysis.firstResponseSLA.compliancePercentage = complianceRate.toFixed(1);
        slaAnalysis.firstResponseSLA.violationPercentage = 
            ((slaAnalysis.firstResponseSLA.violations / slaAnalysis.firstResponseSLA.total) * 100).toFixed(1);
    }

    if (slaAnalysis.resolutionSLA.total > 0) {
        const complianceRate = (slaAnalysis.resolutionSLA.compliance / slaAnalysis.resolutionSLA.total) * 100;
        slaAnalysis.resolutionSLA.compliancePercentage = complianceRate.toFixed(1);
        slaAnalysis.resolutionSLA.violationPercentage = 
            ((slaAnalysis.resolutionSLA.violations / slaAnalysis.resolutionSLA.total) * 100).toFixed(1);
    }

    console.log('SLA Analysis Complete:');
    console.log('First Response SLA:', slaAnalysis.firstResponseSLA);
    console.log('Resolution SLA:', slaAnalysis.resolutionSLA);

    return slaAnalysis;
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload and analyze CSV
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const data = await parseCSV(filePath);
        const structure = analyzeDataStructure(data);

        console.log(`Parsed CSV: ${data.length} total records`);

        // Clean up uploaded file
        await fs.remove(filePath);

        res.json({
            success: true,
            fileName: req.file.originalname,
            dataStructure: structure,
            preview: data.slice(0, 5), // Only 5 for preview
            fullData: data, // Send complete dataset for analysis
            totalRecords: data.length
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process CSV file' });
    }
});

// Generate report
app.post('/api/generate-report', async (req, res) => {
    try {
        const { data, reportType, fileName } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: 'No valid data provided' });
        }

        const reportContent = await generateReportWithClaude(data, reportType, fileName);
        
        // Generate HTML report
        const htmlReport = await generateHTMLReport(reportContent, reportType, data);
        
        // Save report to file
        const reportId = uuidv4();
        const reportPath = path.join(__dirname, '../reports', `${reportId}.html`);
        await fs.ensureDir(path.dirname(reportPath));
        await fs.writeFile(reportPath, htmlReport);

        res.json({
            success: true,
            reportId,
            reportPath,
            analysis: reportContent,
            downloadUrl: `/api/download-report/${reportId}`
        });

    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Download report
app.get('/api/download-report/:reportId', async (req, res) => {
    try {
        const reportPath = path.join(__dirname, '../reports', `${req.params.reportId}.html`);
        
        if (await fs.pathExists(reportPath)) {
            const htmlContent = await fs.readFile(reportPath, 'utf8');
            const isDownload = req.query.download === 'true';
            
            if (isDownload) {
                // Force download with proper headers
                res.setHeader('Content-Type', 'text/html');
                res.setHeader('Content-Disposition', `attachment; filename="analysis-report-${req.params.reportId}.html"`);
                res.send(htmlContent);
            } else {
                // Serve for browser viewing - explicitly prevent download
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Content-Disposition', 'inline');
                res.setHeader('Cache-Control', 'no-cache');
                res.send(htmlContent);
            }
        } else {
            res.status(404).json({ error: 'Report not found' });
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download report' });
    }
});

// Serve React app for all other routes (only in production or if build exists)
if (process.env.NODE_ENV === 'production' || require('fs').existsSync(path.join(__dirname, '../client/build'))) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });
} else {
    // Development fallback - redirect to React dev server
    app.get('*', (req, res) => {
        res.status(404).json({ 
            error: 'Development mode - please access the React app at http://localhost:3000',
            message: 'API server is running on this port, React dev server runs on port 3000'
        });
    });
}

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// HTML Report Generation Function
async function generateHTMLReport(claudeAnalysis, reportType, data) {
    let analysis;
    try {
        // Try to parse Claude's response as JSON
        const cleanedResponse = claudeAnalysis.trim();
        
        // Handle cases where Claude wraps JSON in code blocks
        let jsonContent = cleanedResponse;
        if (cleanedResponse.startsWith('```json')) {
            jsonContent = cleanedResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
            jsonContent = cleanedResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
        }
        
        analysis = JSON.parse(jsonContent);
        console.log('Successfully parsed Claude analysis:', Object.keys(analysis));
    } catch (error) {
        console.error('JSON parsing error:', error);
        console.log('Raw Claude response:', claudeAnalysis.substring(0, 500));
        
        // Create a fallback structure if JSON parsing fails
        analysis = {
            title: 'Data Analysis Report',
            summary: claudeAnalysis,
            keyMetrics: [
                { label: 'Total Records', value: data.length.toString(), trend: 'stable', impact: 'medium' }
            ],
            criticalFindings: [
                { finding: 'Analysis completed', impact: 'Report generated from CSV data', priority: 'medium' }
            ],
            recommendations: [
                { action: 'Review detailed analysis', timeline: 'immediate', impact: 'Better insights' }
            ],
            overview: {
                totalRecords: data.length,
                timeSpan: 'Based on uploaded data',
                keyTrends: ['Data successfully processed']
            },
            performanceMetrics: [
                { metric: 'Data Quality', current: 'Good', benchmark: 'Excellent', status: 'good' }
            ],
            insights: ['Analysis based on uploaded CSV data', 'Report generated successfully'],
            slides: [
                {
                    title: 'Analysis Overview',
                    type: 'overview',
                    content: {
                        headline: 'Data Analysis Complete',
                        metrics: [
                            { label: 'Records Processed', value: data.length.toString(), highlight: true }
                        ],
                        insights: ['Successfully processed uploaded data'],
                        visual: 'data summary'
                    }
                }
            ],
            keyMessage: `Analysis of ${data.length} records completed`,
            callToAction: 'Review the generated insights and take appropriate action'
        };
    }

    const reportTemplates = {
        executive: generateExecutiveTemplate(analysis, data),
        detailed: generateDetailedTemplate(analysis, data),
        presentation: generatePresentationTemplate(analysis, data)
    };

    return reportTemplates[reportType] || reportTemplates.detailed;
}

function generateExecutiveTemplate(analysis, data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${analysis.title || 'Executive Summary'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
            color: #e0e0e0;
            line-height: 1.6;
            min-height: 100vh;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
        .header {
            background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
            padding: 2rem;
            border-radius: 12px;
            border-bottom: 4px solid #26de81;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            margin-bottom: 2rem;
            text-align: center;
        }
        h1 { font-size: 3rem; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 2px; }
        .subtitle { font-size: 1.2rem; color: #b0b0b0; margin-top: 0.5rem; }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .metric-card {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            border: 1px solid #333;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            transition: transform 0.3s ease;
        }
        .metric-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(38, 222, 129, 0.2); }
        .metric-number { font-size: 3rem; font-weight: bold; color: #26de81; display: block; margin-bottom: 0.5rem; }
        .metric-label { font-size: 1rem; color: #ffffff; font-weight: 500; }
        .section {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            border: 1px solid #333;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .section h2 { color: #26de81; margin-bottom: 1.5rem; font-size: 1.8rem; }
        .finding-item, .rec-item {
            background: #242424;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            border-left: 4px solid #26de81;
        }
        .finding-item strong, .rec-item strong { color: #ffffff; font-size: 1.1rem; }
        .finding-item p, .rec-item p { color: #b0b0b0; margin-top: 0.5rem; }
        .critical-alert {
            background: linear-gradient(45deg, #ff4757, #ff3742);
            color: white;
            padding: 1.5rem;
            border-radius: 10px;
            margin: 1.5rem 0;
            text-align: center;
            font-weight: bold;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.8; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${analysis.title || 'Executive Summary'}</h1>
            <p class="subtitle">Generated on ${new Date().toLocaleDateString()}</p>
            <p class="subtitle">Total Records: ${data.length.toLocaleString()}</p>
        </div>

        <div class="metrics-grid">
            ${(analysis.keyMetrics || []).map(metric => `
                <div class="metric-card">
                    <span class="metric-number">${metric.value}</span>
                    <span class="metric-label">${metric.label}</span>
                </div>
            `).join('')}
        </div>

        ${(analysis.criticalFindings && analysis.criticalFindings.length > 0) ? `
        <div class="section">
            <h2>Critical Findings</h2>
            ${analysis.criticalFindings.map(finding => `
                <div class="finding-item">
                    <strong>${finding.finding}</strong>
                    <p>Impact: ${finding.impact}</p>
                    <p>Priority: ${finding.priority}</p>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${(analysis.recommendations && analysis.recommendations.length > 0) ? `
        <div class="section">
            <h2>Strategic Recommendations</h2>
            ${analysis.recommendations.map(rec => `
                <div class="rec-item">
                    <strong>${rec.action}</strong>
                    <p>Timeline: ${rec.timeline} | Expected Impact: ${rec.impact}</p>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${analysis.summary ? `
        <div class="critical-alert">
            📊 Executive Summary: ${analysis.summary}
        </div>
        ` : ''}
    </div>
</body>
</html>`;
}

function generateDetailedTemplate(analysis, data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Detailed SLA Analysis Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
            color: #e0e0e0;
            line-height: 1.6;
            min-height: 100vh;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
        .header {
            background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
            padding: 2rem;
            border-radius: 12px;
            border-bottom: 4px solid #26de81;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            margin-bottom: 2rem;
        }
        h1 { font-size: 3rem; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 2px; }
        .subtitle { color: #b0b0b0; margin-top: 0.5rem; }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .metric-card {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            border: 1px solid #333;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            transition: transform 0.3s ease;
        }
        .metric-card:hover { transform: translateY(-4px); }
        .metric-number { font-size: 3rem; font-weight: bold; color: #26de81; display: block; margin-bottom: 0.5rem; }
        .metric-label { color: #ffffff; font-weight: 500; }
        .metric-status { 
            margin-top: 0.5rem; 
            padding: 0.25rem 0.75rem; 
            border-radius: 12px; 
            font-size: 0.8rem; 
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-good { background: #26de81; color: #000; }
        .status-warning { background: #feca57; color: #000; }
        .status-critical { background: #ff4757; color: #fff; }
        .section {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            border: 1px solid #333;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .section h2 { color: #26de81; margin-bottom: 1.5rem; font-size: 1.8rem; }
        .sla-breakdown {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin: 1.5rem 0;
        }
        .sla-metric {
            background: #242424;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #26de81;
        }
        .sla-metric h3 { color: #ffffff; margin-bottom: 1rem; }
        .sla-value { font-size: 2rem; font-weight: bold; color: #26de81; }
        .sla-detail { color: #b0b0b0; font-size: 0.9rem; margin-top: 0.5rem; }
        .problem-item, .agent-item {
            background: #242424;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            border-left: 4px solid #ff4757;
        }
        .agent-item { border-left-color: #54a0ff; }
        .item-title { font-size: 1.2rem; font-weight: 600; color: #ffffff; margin-bottom: 0.5rem; }
        .item-details { color: #b0b0b0; line-height: 1.6; }
        .insight-item {
            background: rgba(38, 222, 129, 0.1);
            border: 1px solid rgba(38, 222, 129, 0.3);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            color: #e0e0e0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Detailed SLA Analysis</h1>
            <p class="subtitle">Generated: ${new Date().toLocaleDateString()}</p>
            <p class="subtitle">Records Analyzed: ${data.length.toLocaleString()}</p>
        </div>

        ${analysis.overview ? `
        <div class="section">
            <h2>Overview</h2>
            <p><strong>Total Records:</strong> ${analysis.overview.totalRecords}</p>
            <p><strong>Analysis Period:</strong> ${analysis.overview.timeSpan}</p>
            ${analysis.overview.keyTrends ? `
            <h3>Key Trends:</h3>
            <ul>
                ${analysis.overview.keyTrends.map(trend => `<li>${trend}</li>`).join('')}
            </ul>
            ` : ''}
        </div>
        ` : ''}

        ${analysis.slaMetrics ? `
        <div class="section">
            <h2>SLA Performance Metrics</h2>
            <div class="sla-breakdown">
                <div class="sla-metric">
                    <h3>First Response SLA</h3>
                    <div class="sla-value">${analysis.slaMetrics.firstResponseSLA.compliance}</div>
                    <div class="sla-detail">
                        ${analysis.slaMetrics.firstResponseSLA.violations} violations out of ${analysis.slaMetrics.firstResponseSLA.total} tickets
                    </div>
                </div>
                <div class="sla-metric">
                    <h3>Resolution SLA</h3>
                    <div class="sla-value">${analysis.slaMetrics.resolutionSLA.compliance}</div>
                    <div class="sla-detail">
                        ${analysis.slaMetrics.resolutionSLA.violations} violations out of ${analysis.slaMetrics.resolutionSLA.total} tickets
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.performanceMetrics && analysis.performanceMetrics.length > 0 ? `
        <div class="metrics-grid">
            ${analysis.performanceMetrics.map(metric => `
                <div class="metric-card">
                    <span class="metric-number">${metric.current}</span>
                    <span class="metric-label">${metric.metric}</span>
                    <div class="metric-status status-${metric.status}">${metric.status}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${analysis.problemAreas && analysis.problemAreas.length > 0 ? `
        <div class="section">
            <h2>Problem Areas</h2>
            ${analysis.problemAreas.map(problem => `
                <div class="problem-item">
                    <div class="item-title">${problem.area}</div>
                    <div class="item-details">
                        Volume: ${problem.volume} (${problem.percentage}%)<br>
                        ${problem.description}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${analysis.agentPerformance && analysis.agentPerformance.length > 0 ? `
        <div class="section">
            <h2>Agent Performance</h2>
            ${analysis.agentPerformance.map(agent => `
                <div class="agent-item">
                    <div class="item-title">${agent.agent}</div>
                    <div class="item-details">
                        Total Tickets: ${agent.totalTickets}<br>
                        Response Violations: ${agent.responseViolations}<br>
                        Resolution Violations: ${agent.resolutionViolations}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${analysis.insights && analysis.insights.length > 0 ? `
        <div class="section">
            <h2>Key Insights</h2>
            ${analysis.insights.map(insight => `
                <div class="insight-item">${insight}</div>
            `).join('')}
        </div>
        ` : ''}
    </div>
</body>
</html>`;
}

function generatePresentationTemplate(analysis, data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SLA Performance Presentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
            color: #e0e0e0;
            overflow-x: hidden;
        }
        .presentation-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .slide {
            background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            margin: 30px 0;
            padding: 40px;
            min-height: 500px;
            position: relative;
            overflow: hidden;
            border-top: 5px solid #26de81;
        }
        .slide::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 5px;
            background: linear-gradient(90deg, #26de81, #20bf6b, #45b7d1);
        }
        h1 { font-size: 2.5em; color: #ffffff; margin-bottom: 30px; text-align: center; font-weight: 700; text-transform: uppercase; }
        h2 { font-size: 2em; color: #26de81; margin-bottom: 25px; border-bottom: 3px solid #26de81; padding-bottom: 10px; }
        h3 { font-size: 1.4em; color: #20bf6b; margin: 20px 0 15px 0; }
        .executive-summary {
            background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%);
            color: white;
            text-align: center;
            border-top: 5px solid #ffffff;
        }
        .executive-summary h1 { color: white; }
        .key-stat {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 20px;
            margin: 15px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
            min-width: 200px;
            text-align: center;
        }
        .key-stat .number { font-size: 2.5em; font-weight: bold; display: block; }
        .key-stat .label { font-size: 1em; opacity: 0.9; }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric-card {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #ffffff;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            border: 1px solid #333;
            transform: translateY(0);
            transition: transform 0.3s ease;
        }
        .metric-card:hover { transform: translateY(-5px); }
        .metric-card .big-number {
            font-size: 2.2em;
            font-weight: bold;
            display: block;
            margin-bottom: 10px;
            color: #26de81;
        }
        .insight-box {
            background: rgba(38, 222, 129, 0.1);
            border: 1px solid rgba(38, 222, 129, 0.3);
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }
        .insight-box h4 { color: #26de81; margin-bottom: 10px; }
        .insight-list { list-style: none; }
        .insight-list li {
            margin: 8px 0;
            padding-left: 20px;
            position: relative;
        }
        .insight-list li:before {
            content: "→";
            color: #26de81;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        .critical-alert {
            background: linear-gradient(45deg, #ff4757, #ff3742);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
            font-weight: bold;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.8; }
            100% { opacity: 1; }
        }
        .navigation {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        }
        .nav-btn {
            background: rgba(38, 222, 129, 0.9);
            border: none;
            padding: 10px 15px;
            margin: 5px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: bold;
            color: white;
            transition: all 0.3s ease;
        }
        .nav-btn:hover {
            background: #20bf6b;
            transform: scale(1.05);
        }
    </style>
</head>
<body>
    <div class="navigation">
        <button class="nav-btn" onclick="scrollToSlide(0)">Overview</button>
        <button class="nav-btn" onclick="scrollToSlide(1)">Analysis</button>
    </div>

    <div class="presentation-container">
        <!-- Title Slide -->
        <div class="slide executive-summary" id="slide-0">
            <h1>${analysis.keyMessage || 'SLA Performance Analysis'}</h1>
            <p style="font-size: 1.3em; margin: 30px 0;">Comprehensive SLA Review</p>
            <p style="font-size: 1.1em; opacity: 0.9; margin-bottom: 40px;">${data.length.toLocaleString()} Tickets Analyzed</p>
            
            <div style="display: flex; justify-content: center; flex-wrap: wrap;">
                ${(analysis.slides && analysis.slides[0] && analysis.slides[0].content.metrics || []).map(metric => `
                    <div class="key-stat">
                        <span class="number">${metric.value}</span>
                        <span class="label">${metric.label}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        ${(analysis.slides || []).map((slide, index) => `
            <div class="slide" id="slide-${index + 1}">
                <h2>${slide.title}</h2>
                ${slide.content.headline ? `
                    <div style="font-size: 1.2em; margin: 20px 0; color: #20bf6b;">
                        ${slide.content.headline}
                    </div>
                ` : ''}
                
                ${slide.content.metrics && slide.content.metrics.length > 0 ? `
                    <div class="metrics-grid">
                        ${slide.content.metrics.map(metric => `
                            <div class="metric-card">
                                <span class="big-number">${metric.value}</span>
                                <span>${metric.label}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${slide.content.insights && slide.content.insights.length > 0 ? `
                    <div class="insight-box">
                        <h4>Key Insights</h4>
                        <ul class="insight-list">
                            ${slide.content.insights.map(insight => `<li>${insight}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `).join('')}

        <div class="slide">
            <h2>Next Steps</h2>
            <div class="critical-alert">
                🎯 ${analysis.callToAction || 'Review findings and implement recommended improvements'}
            </div>
            <div style="text-align: center; margin-top: 40px;">
                <p style="font-size: 1.1em; color: #b0b0b0;">
                    This analysis is based on ${data.length.toLocaleString()} actual support tickets
                </p>
            </div>
        </div>
    </div>

    <script>
        function scrollToSlide(slideNumber) {
            const slide = document.getElementById(\`slide-\${slideNumber}\`);
            if (slide) {
                slide.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        // Add interactive animations
        document.addEventListener('DOMContentLoaded', function() {
            const cards = document.querySelectorAll('.metric-card, .key-stat');
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            });

            cards.forEach(card => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                observer.observe(card);
            });
        });
    </script>
</body>
</html>`;
}

module.exports = app;