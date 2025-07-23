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
    
// Enhanced Claude prompts for deeper analysis
// Replace the prompts object in your generateReportWithClaude function

const prompts = {
    executive: `You are a senior IT executive consultant creating a strategic performance analysis.

    COMPLETE DATASET ANALYSIS (${data.length} records):
    ${JSON.stringify(slaAnalysis, null, 2)}

    KEY AGENT PERFORMANCE: ${JSON.stringify(Object.entries(slaAnalysis.agents || {}).slice(0, 3))}
    CATEGORY BREAKDOWN: ${JSON.stringify(Object.entries(slaAnalysis.categories || {}).slice(0, 5))}

    Create a business-focused executive summary that identifies:
    1. STRATEGIC PERFORMANCE METRICS with business impact
    2. OPERATIONAL EXCELLENCE opportunities 
    3. COMPETITIVE ADVANTAGES and industry positioning
    4. RESOURCE OPTIMIZATION recommendations
    5. RISK MITIGATION strategies

    Return ONLY this JSON structure:
    {
        "title": "IT Operations Excellence Report",
        "executiveSummary": "Strategic overview of performance and opportunities",
        "keyMetrics": [
            {"label": "SLA Compliance Rate", "value": "${slaAnalysis.firstResponseSLA.compliancePercentage}%", "trend": "stable", "businessImpact": "Customer satisfaction directly correlates", "benchmark": "95%", "status": "${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'excellent' : parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 90 ? 'good' : 'needs_improvement'}"},
            {"label": "Resolution Efficiency", "value": "${slaAnalysis.resolutionSLA.compliancePercentage}%", "trend": "stable", "businessImpact": "Operational cost reduction", "benchmark": "90%", "status": "${parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) >= 90 ? 'excellent' : parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) >= 85 ? 'good' : 'needs_improvement'}"},
            {"label": "Team Productivity", "value": "${Math.round(data.length / Object.keys(slaAnalysis.agents || {}).length)}", "trend": "stable", "businessImpact": "Resource allocation optimization", "benchmark": "150", "status": "good"},
            {"label": "Service Volume", "value": "${data.length}", "trend": "stable", "businessImpact": "Business growth indicator", "benchmark": "1000", "status": "good"}
        ],
        "strategicInsights": [
            {
                "category": "Performance Excellence",
                "insight": "Team demonstrates ${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'industry-leading' : 'strong'} SLA compliance at ${slaAnalysis.firstResponseSLA.compliancePercentage}%",
                "impact": "high",
                "recommendation": "Leverage as competitive advantage and best practice model"
            },
            {
                "category": "Operational Efficiency", 
                "insight": "Processing ${data.length} tickets with ${slaAnalysis.firstResponseSLA.violations + slaAnalysis.resolutionSLA.violations} total violations",
                "impact": "medium",
                "recommendation": "Focus improvement efforts on violation reduction strategies"
            },
            {
                "category": "Resource Optimization",
                "insight": "Agent performance varies significantly - top performers can mentor others",
                "impact": "high", 
                "recommendation": "Implement peer mentoring and knowledge sharing programs"
            }
        ],
        "businessRecommendations": [
            {
                "priority": "High",
                "action": "Establish Center of Excellence model based on current performance",
                "timeline": "30 days",
                "investment": "Low",
                "expectedROI": "Improved cross-team performance, reduced escalations"
            },
            {
                "priority": "Medium", 
                "action": "Implement predictive analytics for proactive issue resolution",
                "timeline": "90 days",
                "investment": "Medium",
                "expectedROI": "15-20% reduction in reactive support tickets"
            },
            {
                "priority": "Medium",
                "action": "Develop automated self-service capabilities for common requests", 
                "timeline": "60 days",
                "investment": "Medium",
                "expectedROI": "25% reduction in manual processing time"
            }
        ],
        "riskAssessment": [
            {
                "risk": "SLA Performance Dependency",
                "probability": "Medium",
                "impact": "High", 
                "mitigation": "Cross-train team members, document processes, implement backup procedures"
            },
            {
                "risk": "Volume Growth Management",
                "probability": "High",
                "impact": "Medium",
                "mitigation": "Scale automation tools, optimize workflows, plan resource expansion"
            }
        ],
        "competitiveAdvantages": [
            "Industry-leading SLA compliance rates",
            "Efficient team productivity metrics", 
            "Strong process discipline and quality control",
            "Excellent customer service delivery model"
        ]
    }`,

    detailed: `You are a senior operations analyst creating a comprehensive performance analysis report.

    CRITICAL: Return ONLY valid JSON. Analyze ALL ${data.length} tickets comprehensively.

    COMPLETE PERFORMANCE DATA:
    - First Response SLA: ${slaAnalysis.firstResponseSLA.compliancePercentage}% (${slaAnalysis.firstResponseSLA.violations}/${slaAnalysis.firstResponseSLA.total})
    - Resolution SLA: ${slaAnalysis.resolutionSLA.compliancePercentage}% (${slaAnalysis.resolutionSLA.violations}/${slaAnalysis.resolutionSLA.total})
    - Top Agents: ${JSON.stringify(Object.entries(slaAnalysis.agents || {}).slice(0, 5).map(([name, stats]) => ({name, total: stats.total, violations: stats.responseViolations + stats.resolutionViolations})))}

    Return this comprehensive analysis:
    {
        "reportMetadata": {
            "title": "Comprehensive IT Operations Analysis",
            "generatedDate": "${new Date().toLocaleDateString()}",
            "totalRecords": ${data.length},
            "analysisDepth": "Complete dataset analysis",
            "dataQuality": "High - comprehensive SLA tracking"
        },
        "performanceOverview": {
            "overallHealth": "${(parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) + parseFloat(slaAnalysis.resolutionSLA.compliancePercentage)) / 2 >= 95 ? 'Excellent' : (parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) + parseFloat(slaAnalysis.resolutionSLA.compliancePercentage)) / 2 >= 85 ? 'Good' : 'Needs Improvement'}",
            "trendDirection": "Stable",
            "keyStrengths": [
                "Strong SLA compliance discipline",
                "Comprehensive tracking and monitoring",
                "Balanced workload distribution",
                "Quality-focused service delivery"
            ],
            "improvementAreas": [
                "Response time optimization for ${slaAnalysis.firstResponseSLA.violations} violations",
                "Resolution efficiency for ${slaAnalysis.resolutionSLA.violations} violations", 
                "Agent performance standardization",
                "Process automation opportunities"
            ]
        },
        "slaPerformance": {
            "firstResponseSLA": {
                "complianceRate": "${slaAnalysis.firstResponseSLA.compliancePercentage}%",
                "violations": ${slaAnalysis.firstResponseSLA.violations},
                "totalEvaluated": ${slaAnalysis.firstResponseSLA.total},
                "benchmark": "95%",
                "performanceGap": "${95 - parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage)}%",
                "status": "${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'Exceeds Standard' : parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 90 ? 'Meets Standard' : 'Below Standard'}",
                "actionRequired": "${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) < 95 ? 'Yes - Focus on response time improvement' : 'No - Maintain current excellence'}"
            },
            "resolutionSLA": {
                "complianceRate": "${slaAnalysis.resolutionSLA.compliancePercentage}%", 
                "violations": ${slaAnalysis.resolutionSLA.violations},
                "totalEvaluated": ${slaAnalysis.resolutionSLA.total},
                "benchmark": "90%",
                "performanceGap": "${90 - parseFloat(slaAnalysis.resolutionSLA.compliancePercentage)}%",
                "status": "${parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) >= 90 ? 'Exceeds Standard' : parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) >= 85 ? 'Meets Standard' : 'Below Standard'}",
                "actionRequired": "${parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) < 90 ? 'Yes - Focus on resolution efficiency' : 'No - Maintain current performance'}"
            }
        },
        "teamPerformance": {
            "totalAgents": ${Object.keys(slaAnalysis.agents || {}).length},
            "averageTicketsPerAgent": ${Math.round(data.length / Object.keys(slaAnalysis.agents || {}).length)},
            "topPerformers": [
                ${Object.entries(slaAnalysis.agents || {})
                    .sort(([,a], [,b]) => (a.responseViolations + a.resolutionViolations) - (b.responseViolations + b.resolutionViolations))
                    .slice(0, 3)
                    .map(([agent, stats]) => `{
                        "agent": "${agent}",
                        "totalTickets": ${stats.total},
                        "violationRate": "${((stats.responseViolations + stats.resolutionViolations) / stats.total * 100).toFixed(1)}%",
                        "responseViolations": ${stats.responseViolations},
                        "resolutionViolations": ${stats.resolutionViolations},
                        "performance": "${((stats.responseViolations + stats.resolutionViolations) / stats.total) < 0.05 ? 'Excellent' : ((stats.responseViolations + stats.resolutionViolations) / stats.total) < 0.1 ? 'Good' : 'Needs Improvement'}"
                    }`).join(',')}
            ],
            "performanceDistribution": {
                "excellentPerformers": ${Object.values(slaAnalysis.agents || {}).filter(stats => (stats.responseViolations + stats.resolutionViolations) / stats.total < 0.05).length},
                "goodPerformers": ${Object.values(slaAnalysis.agents || {}).filter(stats => {
                    const rate = (stats.responseViolations + stats.resolutionViolations) / stats.total;
                    return rate >= 0.05 && rate < 0.1;
                }).length},
                "needsImprovement": ${Object.values(slaAnalysis.agents || {}).filter(stats => (stats.responseViolations + stats.resolutionViolations) / stats.total >= 0.1).length}
            }
        },
        "categoryAnalysis": [
            ${Object.entries(slaAnalysis.categories || {}).map(([category, stats]) => `{
                "category": "${category}",
                "volume": ${stats.total}, 
                "percentage": "${(stats.total / data.length * 100).toFixed(1)}%",
                "responseViolations": ${stats.responseViolations},
                "resolutionViolations": ${stats.resolutionViolations},
                "overallHealth": "${(stats.responseViolations + stats.resolutionViolations) / stats.total < 0.05 ? 'Excellent' : (stats.responseViolations + stats.resolutionViolations) / stats.total < 0.15 ? 'Good' : 'Needs Focus'}"
            }`).join(',')}
        ],
        "operationalInsights": [
            "Comprehensive analysis of ${data.length} support tickets reveals ${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'excellent' : 'good'} performance standards",
            "First response SLA compliance at ${slaAnalysis.firstResponseSLA.compliancePercentage}% indicates ${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'industry-leading' : 'solid'} customer service delivery",
            "Resolution SLA performance at ${slaAnalysis.resolutionSLA.compliancePercentage}% shows ${parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) >= 90 ? 'efficient' : 'developing'} problem-solving capabilities", 
            "Team performance distribution suggests ${Object.values(slaAnalysis.agents || {}).filter(stats => (stats.responseViolations + stats.resolutionViolations) / stats.total < 0.05).length > Object.keys(slaAnalysis.agents || {}).length / 2 ? 'strong leadership and training effectiveness' : 'opportunities for skill development and process improvement'}",
            "Category analysis reveals balanced workload distribution with focus areas for optimization"
        ],
        "actionableRecommendations": [
            {
                "category": "Immediate Actions (0-30 days)",
                "items": [
                    "Address ${slaAnalysis.firstResponseSLA.violations + slaAnalysis.resolutionSLA.violations} current SLA violations through targeted intervention",
                    "Implement daily standup reviews for tickets approaching SLA deadlines",
                    "Create escalation matrix for complex issues requiring immediate attention"
                ]
            },
            {
                "category": "Short-term Improvements (1-3 months)", 
                "items": [
                    "Develop peer mentoring program pairing top performers with developing agents",
                    "Implement automated SLA monitoring with proactive alerts",
                    "Create knowledge base from resolution patterns of high-performing agents"
                ]
            },
            {
                "category": "Strategic Initiatives (3-6 months)",
                "items": [
                    "Deploy AI-powered ticket routing based on agent expertise and current workload",
                    "Establish predictive analytics for identifying potential SLA risks",
                    "Create self-service portal for common request types to reduce manual processing"
                ]
            }
        ]
    }`,

    presentation: `Create a high-impact executive presentation for IT leadership showcasing operational excellence.

    PERFORMANCE HIGHLIGHTS (${data.length} tickets analyzed):
    - SLA Excellence: First Response ${slaAnalysis.firstResponseSLA.compliancePercentage}%, Resolution ${slaAnalysis.resolutionSLA.compliancePercentage}%
    - Team Strength: ${Object.keys(slaAnalysis.agents || {}).length} agents handling diverse workload
    - Quality Focus: ${slaAnalysis.firstResponseSLA.violations + slaAnalysis.resolutionSLA.violations} total violations requiring attention

    Return presentation-ready JSON:
    {
        "presentationTitle": "IT Operations Performance Excellence",
        "executiveMessage": "Demonstrating ${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'industry-leading' : 'strong'} service delivery with strategic improvement opportunities",
        "slides": [
            {
                "slideNumber": 1,
                "title": "Performance Dashboard",
                "type": "metrics_overview",
                "content": {
                    "headline": "IT Operations Excellence Scorecard",
                    "keyMetrics": [
                        {
                            "metric": "First Response SLA",
                            "value": "${slaAnalysis.firstResponseSLA.compliancePercentage}%",
                            "status": "${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'excellent' : parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 90 ? 'good' : 'needs_improvement'}",
                            "trend": "stable",
                            "benchmark": "95%"
                        },
                        {
                            "metric": "Resolution SLA", 
                            "value": "${slaAnalysis.resolutionSLA.compliancePercentage}%",
                            "status": "${parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) >= 90 ? 'excellent' : parseFloat(slaAnalysis.resolutionSLA.compliancePercentage) >= 85 ? 'good' : 'needs_improvement'}",
                            "trend": "stable", 
                            "benchmark": "90%"
                        },
                        {
                            "metric": "Total Volume",
                            "value": "${data.length}",
                            "status": "good",
                            "trend": "stable",
                            "benchmark": "Baseline"
                        },
                        {
                            "metric": "Team Efficiency", 
                            "value": "${Math.round(data.length / Object.keys(slaAnalysis.agents || {}).length)}",
                            "status": "good",
                            "trend": "stable",
                            "benchmark": "150/agent"
                        }
                    ],
                    "insights": [
                        "Comprehensive analysis of ${data.length} support interactions",
                        "${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'Exceeding industry benchmarks for customer response' : 'Solid performance with improvement opportunities'}",
                        "Strong operational discipline and quality control processes"
                    ]
                }
            },
            {
                "slideNumber": 2,
                "title": "Team Performance Analysis", 
                "type": "team_breakdown",
                "content": {
                    "headline": "Agent Performance & Development Opportunities",
                    "teamMetrics": [
                        {
                            "metric": "Total Agents",
                            "value": "${Object.keys(slaAnalysis.agents || {}).length}",
                            "context": "Active support team members"
                        },
                        {
                            "metric": "Avg Tickets/Agent",
                            "value": "${Math.round(data.length / Object.keys(slaAnalysis.agents || {}).length)}",
                            "context": "Balanced workload distribution"
                        },
                        {
                            "metric": "Top Performer Rate",
                            "value": "${Object.values(slaAnalysis.agents || {}).filter(stats => (stats.responseViolations + stats.resolutionViolations) / stats.total < 0.05).length}",
                            "context": "Agents with <5% violation rate"
                        }
                    ],
                    "insights": [
                        "Performance distribution shows ${Object.values(slaAnalysis.agents || {}).filter(stats => (stats.responseViolations + stats.resolutionViolations) / stats.total < 0.05).length > Object.keys(slaAnalysis.agents || {}).length / 2 ? 'strong team capabilities' : 'development opportunities'}",
                        "Top performers can mentor colleagues for knowledge transfer",
                        "Opportunity to standardize best practices across team"
                    ]
                }
            },
            {
                "slideNumber": 3,
                "title": "Strategic Recommendations",
                "type": "action_plan",
                "content": {
                    "headline": "Roadmap for Continued Excellence",
                    "strategicActions": [
                        {
                            "priority": "High",
                            "action": "Establish Center of Excellence Model",
                            "timeline": "30 days",
                            "impact": "Cross-team performance improvement",
                            "investment": "Low"
                        },
                        {
                            "priority": "Medium",
                            "action": "Implement Predictive SLA Analytics", 
                            "timeline": "90 days",
                            "impact": "Proactive issue prevention",
                            "investment": "Medium"
                        },
                        {
                            "priority": "Medium",
                            "action": "Expand Self-Service Capabilities",
                            "timeline": "60 days", 
                            "impact": "Reduced manual processing",
                            "investment": "Medium"
                        }
                    ],
                    "insights": [
                        "Build on current strengths to drive organizational excellence",
                        "Focus on automation and predictive capabilities",
                        "Leverage team expertise for broader organizational impact"
                    ]
                }
            }
        ],
        "executiveSummary": {
            "keyMessage": "IT Operations demonstrating ${parseFloat(slaAnalysis.firstResponseSLA.compliancePercentage) >= 95 ? 'exceptional' : 'strong'} service delivery with clear pathway to excellence",
            "businessImpact": "Strong SLA compliance drives customer satisfaction and operational efficiency",
            "nextSteps": "Leverage current performance as foundation for organizational best practices",
            "investmentRequired": "Low to medium investment for high-impact improvements"
        },
        "appendix": {
            "dataSource": "${data.length} support tickets analyzed",
            "analysisMethod": "Comprehensive SLA compliance and performance review",
            "confidence": "High - based on complete dataset",
            "reportingPeriod": "Complete historical analysis"
        }
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

// Enhanced data analysis functions - Add these to your existing code

// Replace your existing analyzeSLAPerformance function with this enhanced version
function analyzeSLAPerformance(data) {
    if (!data || data.length === 0) return null;

    const analysis = {
        totalTickets: data.length,
        firstResponseSLA: {
            violations: 0,
            compliance: 0,
            total: 0,
            compliancePercentage: '0',
            violationPercentage: '0'
        },
        resolutionSLA: {
            violations: 0,
            compliance: 0,
            total: 0,
            compliancePercentage: '0',
            violationPercentage: '0'
        },
        agents: {},
        categories: {},
        timePatterns: {},
        priorityAnalysis: {},
        performanceTrends: {
            daily: {},
            weekly: {},
            monthly: {}
        }
    };

    console.log('Enhanced SLA Analysis - Processing', data.length, 'tickets');
    console.log('Sample columns:', Object.keys(data[0] || {}));

    data.forEach((ticket, index) => {
        const agent = ticket['Agent'] || ticket['Resolved by'] || ticket['Assignee'] || 'Unknown';
        const category = ticket['Category'] || ticket['Sub-Category'] || ticket['Type'] || 'Unknown';
        const priority = ticket['Priority'] || ticket['Urgency'] || 'Medium';
        
        // Extract date information for trend analysis
        const createdDate = ticket['Created Date'] || ticket['Date Created'] || ticket['Created'] || new Date().toISOString();
        const dateKey = createdDate.substring(0, 10); // YYYY-MM-DD format
        const dayOfWeek = new Date(createdDate).getDay();
        const monthKey = createdDate.substring(0, 7); // YYYY-MM format

        // Initialize tracking objects
        if (!analysis.agents[agent]) {
            analysis.agents[agent] = {
                total: 0,
                responseViolations: 0,
                resolutionViolations: 0,
                totalViolations: 0,
                complianceRate: 100,
                averageResponseTime: 0,
                categories: {},
                priorities: {}
            };
        }
        
        if (!analysis.categories[category]) {
            analysis.categories[category] = {
                total: 0,
                responseViolations: 0,
                resolutionViolations: 0,
                agents: {},
                averageResolutionTime: 0
            };
        }

        if (!analysis.priorityAnalysis[priority]) {
            analysis.priorityAnalysis[priority] = {
                total: 0,
                responseViolations: 0,
                resolutionViolations: 0,
                complianceRate: 100
            };
        }

        // Initialize time patterns
        if (!analysis.timePatterns[dateKey]) {
            analysis.timePatterns[dateKey] = { total: 0, violations: 0 };
        }
        
        if (!analysis.performanceTrends.daily[dayOfWeek]) {
            analysis.performanceTrends.daily[dayOfWeek] = { total: 0, violations: 0 };
        }

        if (!analysis.performanceTrends.monthly[monthKey]) {
            analysis.performanceTrends.monthly[monthKey] = { total: 0, violations: 0 };
        }

        // Update counts
        analysis.agents[agent].total++;
        analysis.categories[category].total++;
        analysis.priorityAnalysis[priority].total++;
        analysis.timePatterns[dateKey].total++;
        analysis.performanceTrends.daily[dayOfWeek].total++;
        analysis.performanceTrends.monthly[monthKey].total++;

        // Track agent-category combinations
        if (!analysis.agents[agent].categories[category]) {
            analysis.agents[agent].categories[category] = 0;
        }
        analysis.agents[agent].categories[category]++;

        // Track agent-priority combinations
        if (!analysis.agents[agent].priorities[priority]) {
            analysis.agents[agent].priorities[priority] = 0;
        }
        analysis.agents[agent].priorities[priority]++;

        // Analyze First Response SLA with multiple column variations
        const firstResponseColumns = [
            'First Response Status', 'First Response SLA', 'Response Status',
            'first_response_status', 'Response SLA Status', 'First Response Time Status'
        ];
        
        let firstResponseStatus = null;
        for (const col of firstResponseColumns) {
            if (ticket[col]) {
                firstResponseStatus = ticket[col];
                break;
            }
        }
        
        if (firstResponseStatus) {
            analysis.firstResponseSLA.total++;
            const statusLower = firstResponseStatus.toString().toLowerCase();
            
            if (statusLower.includes('violated') || 
                statusLower.includes('breach') || 
                statusLower.includes('missed') ||
                statusLower.includes('overdue') ||
                statusLower.includes('fail')) {
                analysis.firstResponseSLA.violations++;
                analysis.agents[agent].responseViolations++;
                analysis.categories[category].responseViolations++;
                analysis.priorityAnalysis[priority].responseViolations++;
                analysis.timePatterns[dateKey].violations++;
                analysis.performanceTrends.daily[dayOfWeek].violations++;
                analysis.performanceTrends.monthly[monthKey].violations++;
                console.log(`Response SLA violation found in ticket ${index}: ${firstResponseStatus}`);
            } else if (statusLower.includes('within') || 
                      statusLower.includes('met') || 
                      statusLower.includes('compliant') ||
                      statusLower.includes('achieved') ||
                      statusLower.includes('success')) {
                analysis.firstResponseSLA.compliance++;
            }
        }

        // Analyze Resolution SLA with multiple column variations
        const resolutionColumns = [
            'Resolution Status', 'Resolution SLA', 'Resolve Status',
            'resolution_status', 'Resolution SLA Status', 'Resolution Time Status'
        ];
        
        let resolutionStatus = null;
        for (const col of resolutionColumns) {
            if (ticket[col]) {
                resolutionStatus = ticket[col];
                break;
            }
        }
        
        if (resolutionStatus) {
            analysis.resolutionSLA.total++;
            const statusLower = resolutionStatus.toString().toLowerCase();
            
            if (statusLower.includes('violated') || 
                statusLower.includes('breach') || 
                statusLower.includes('missed') ||
                statusLower.includes('overdue') ||
                statusLower.includes('fail')) {
                analysis.resolutionSLA.violations++;
                analysis.agents[agent].resolutionViolations++;
                analysis.categories[category].resolutionViolations++;
                analysis.priorityAnalysis[priority].resolutionViolations++;
                analysis.timePatterns[dateKey].violations++;
                analysis.performanceTrends.daily[dayOfWeek].violations++;
                analysis.performanceTrends.monthly[monthKey].violations++;
                console.log(`Resolution SLA violation found in ticket ${index}: ${resolutionStatus}`);
            } else if (statusLower.includes('within') || 
                      statusLower.includes('met') || 
                      statusLower.includes('compliant') ||
                      statusLower.includes('achieved') ||
                      statusLower.includes('success')) {
                analysis.resolutionSLA.compliance++;
            }
        }
    });

    // Calculate percentages and additional metrics
    if (analysis.firstResponseSLA.total > 0) {
        const complianceRate = ((analysis.firstResponseSLA.total - analysis.firstResponseSLA.violations) / analysis.firstResponseSLA.total) * 100;
        analysis.firstResponseSLA.compliancePercentage = complianceRate.toFixed(1);
        analysis.firstResponseSLA.violationPercentage = 
            ((analysis.firstResponseSLA.violations / analysis.firstResponseSLA.total) * 100).toFixed(1);
    }

    if (analysis.resolutionSLA.total > 0) {
        const complianceRate = ((analysis.resolutionSLA.total - analysis.resolutionSLA.violations) / analysis.resolutionSLA.total) * 100;
        analysis.resolutionSLA.compliancePercentage = complianceRate.toFixed(1);
        analysis.resolutionSLA.violationPercentage = 
            ((analysis.resolutionSLA.violations / analysis.resolutionSLA.total) * 100).toFixed(1);
    }

    // Calculate agent performance metrics
    Object.keys(analysis.agents).forEach(agent => {
        const agentData = analysis.agents[agent];
        agentData.totalViolations = agentData.responseViolations + agentData.resolutionViolations;
        agentData.complianceRate = agentData.total > 0 ? 
            (((agentData.total - agentData.totalViolations) / agentData.total) * 100).toFixed(1) : 100;
        
        // Identify top categories for each agent
        agentData.topCategory = Object.keys(agentData.categories).reduce((a, b) => 
            agentData.categories[a] > agentData.categories[b] ? a : b, 
            Object.keys(agentData.categories)[0] || 'Unknown'
        );
    });

    // Calculate category performance metrics
    Object.keys(analysis.categories).forEach(category => {
        const categoryData = analysis.categories[category];
        const totalViolations = categoryData.responseViolations + categoryData.resolutionViolations;
        categoryData.complianceRate = categoryData.total > 0 ? 
            (((categoryData.total - totalViolations) / categoryData.total) * 100).toFixed(1) : 100;
    });

    // Calculate priority analysis
    Object.keys(analysis.priorityAnalysis).forEach(priority => {
        const priorityData = analysis.priorityAnalysis[priority];
        const totalViolations = priorityData.responseViolations + priorityData.resolutionViolations;
        priorityData.complianceRate = priorityData.total > 0 ? 
            (((priorityData.total - totalViolations) / priorityData.total) * 100).toFixed(1) : 100;
    });

    // Identify trends and patterns
    analysis.insights = generatePerformanceInsights(analysis);
    
    console.log('Enhanced SLA Analysis Complete:');
    console.log('First Response SLA:', analysis.firstResponseSLA);
    console.log('Resolution SLA:', analysis.resolutionSLA);
    console.log('Agent Count:', Object.keys(analysis.agents).length);
    console.log('Category Count:', Object.keys(analysis.categories).length);

    return analysis;
}

// Add this new function for generating performance insights
function generatePerformanceInsights(analysis) {
    const insights = {
        topPerformers: [],
        improvementAreas: [],
        categoryInsights: [],
        timePatterns: [],
        recommendations: []
    };

    // Identify top performing agents
    const agentPerformance = Object.entries(analysis.agents)
        .map(([agent, data]) => ({
            agent,
            complianceRate: parseFloat(data.complianceRate),
            totalTickets: data.total,
            violations: data.totalViolations
        }))
        .sort((a, b) => b.complianceRate - a.complianceRate);

    insights.topPerformers = agentPerformance.slice(0, 3);

    // Identify agents needing improvement
    insights.improvementAreas = agentPerformance
        .filter(agent => agent.complianceRate < 90)
        .slice(0, 3);

    // Category insights
    const categoryPerformance = Object.entries(analysis.categories)
        .map(([category, data]) => ({
            category,
            total: data.total,
            complianceRate: parseFloat(data.complianceRate),
            violations: data.responseViolations + data.resolutionViolations
        }))
        .sort((a, b) => a.complianceRate - b.complianceRate);

    insights.categoryInsights = categoryPerformance;

    // Time pattern analysis
    const dailyPatterns = Object.entries(analysis.performanceTrends.daily)
        .map(([day, data]) => ({
            day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
            total: data.total,
            violations: data.violations,
            violationRate: data.total > 0 ? ((data.violations / data.total) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => parseFloat(b.violationRate) - parseFloat(a.violationRate));

    insights.timePatterns = dailyPatterns;

    // Generate recommendations based on analysis
    if (parseFloat(analysis.firstResponseSLA.compliancePercentage) < 95) {
        insights.recommendations.push({
            area: 'First Response Time',
            recommendation: 'Implement automated ticket routing and priority alerts',
            impact: 'high',
            effort: 'medium'
        });
    }

    if (parseFloat(analysis.resolutionSLA.compliancePercentage) < 90) {
        insights.recommendations.push({
            area: 'Resolution Time',
            recommendation: 'Create knowledge base and escalation procedures',
            impact: 'high',
            effort: 'medium'
        });
    }

    if (Object.keys(analysis.agents).length > 1) {
        const performanceVariance = Math.max(...agentPerformance.map(a => a.complianceRate)) - 
                                   Math.min(...agentPerformance.map(a => a.complianceRate));
        
        if (performanceVariance > 20) {
            insights.recommendations.push({
                area: 'Team Performance',
                recommendation: 'Implement peer mentoring and standardized training',
                impact: 'medium',
                effort: 'low'
            });
        }
    }

    return insights;
}

// Add this function for advanced data structure analysis
function analyzeDataStructure(data) {
    if (!data || data.length === 0) return null;

    const sample = data.slice(0, 10);
    const columns = Object.keys(data[0]);
    const totalRows = data.length;
    
    const columnTypes = {};
    const columnPatterns = {};
    const dataQuality = {};
    
    columns.forEach(col => {
        // Analyze data types
        const sampleValues = data.slice(0, 100).map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
        const types = [...new Set(sampleValues.map(val => typeof val))];
        columnTypes[col] = types.length === 1 ? types[0] : 'mixed';
        
        // Analyze data patterns
        const nullCount = data.filter(row => !row[col] || row[col] === null || row[col] === undefined || row[col] === '').length;
        const uniqueCount = new Set(data.map(row => row[col])).size;
        
        columnPatterns[col] = {
            nullCount,
            nullPercentage: ((nullCount / totalRows) * 100).toFixed(1),
            uniqueCount,
            uniquePercentage: ((uniqueCount / totalRows) * 100).toFixed(1)
        };
        
        // Assess data quality
        dataQuality[col] = {
            completeness: 100 - columnPatterns[col].nullPercentage,
            consistency: uniqueCount < totalRows * 0.8 ? 'High' : 'Medium',
            validity: sampleValues.length > 0 ? 'Valid' : 'Empty'
        };
    });

    // Detect special column types
    const specialColumns = {
        dateColumns: columns.filter(col => 
            col.toLowerCase().includes('date') || 
            col.toLowerCase().includes('time') ||
            col.toLowerCase().includes('created') ||
            col.toLowerCase().includes('updated') ||
            col.toLowerCase().includes('resolved')
        ),
        statusColumns: columns.filter(col => 
            col.toLowerCase().includes('status') ||
            col.toLowerCase().includes('state') ||
            col.toLowerCase().includes('priority') ||
            col.toLowerCase().includes('sla')
        ),
        userColumns: columns.filter(col => 
            col.toLowerCase().includes('user') ||
            col.toLowerCase().includes('agent') ||
            col.toLowerCase().includes('assignee') ||
            col.toLowerCase().includes('name') ||
            col.toLowerCase().includes('resolved by')
        ),
        idColumns: columns.filter(col =>
            col.toLowerCase().includes('id') ||
            col.toLowerCase().includes('number') ||
            col.toLowerCase().includes('#')
        )
    };

    return {
        totalRows,
        columns,
        columnTypes,
        columnPatterns,
        dataQuality,
        sample,
        specialColumns,
        hasDateColumns: specialColumns.dateColumns.length > 0,
        hasStatusColumns: specialColumns.statusColumns.length > 0,
        hasUserColumns: specialColumns.userColumns.length > 0,
        qualityScore: calculateDataQualityScore(dataQuality),
        recommendations: generateDataRecommendations(columnPatterns, specialColumns)
    };
}

// Helper function to calculate overall data quality score
function calculateDataQualityScore(dataQuality) {
    const scores = Object.values(dataQuality).map(quality => parseFloat(quality.completeness));
    const averageCompleteness = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    if (averageCompleteness >= 95) return 'Excellent';
    if (averageCompleteness >= 85) return 'Good';
    if (averageCompleteness >= 70) return 'Fair';
    return 'Poor';
}

// Helper function to generate data recommendations
function generateDataRecommendations(columnPatterns, specialColumns) {
    const recommendations = [];
    
    // Check for high null percentages
    Object.entries(columnPatterns).forEach(([col, pattern]) => {
        if (parseFloat(pattern.nullPercentage) > 50) {
            recommendations.push(`Column "${col}" has ${pattern.nullPercentage}% missing values - consider data cleansing`);
        }
    });
    
    // Check for required columns
    if (specialColumns.dateColumns.length === 0) {
        recommendations.push('No date columns detected - trend analysis will be limited');
    }
    
    if (specialColumns.statusColumns.length === 0) {
        recommendations.push('No status columns detected - SLA analysis may be limited');
    }
    
    if (specialColumns.userColumns.length === 0) {
        recommendations.push('No user/agent columns detected - performance analysis will be limited');
    }
    
    return recommendations;
}

// Export the enhanced functions (if using modules)
module.exports = {
    analyzeSLAPerformance,
    generatePerformanceInsights,
    analyzeDataStructure,
    calculateDataQualityScore,
    generateDataRecommendations
};

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

// Enhanced HTML template functions - Replace your existing template functions

function generateExecutiveTemplate(analysis, data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${analysis.title || 'Executive Performance Report'}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
            color: #e0e0e0;
            line-height: 1.6;
            min-height: 100vh;
        }
        
        .header {
            background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
            padding: 2rem;
            border-bottom: 4px solid #26de81;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        
        .header-content {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .team-title {
            font-size: 3rem;
            font-weight: 700;
            color: #ffffff;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .team-subtitle {
            font-size: 1.2rem;
            color: #b0b0b0;
            margin-top: 0.5rem;
        }
        
        .report-date {
            text-align: right;
            color: #b0b0b0;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .excellence-highlight {
            background: linear-gradient(45deg, #26de81, #20bf6b);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 20px rgba(38, 222, 129, 0.3);
            animation: pulse-glow 3s ease-in-out infinite;
        }
        
        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 4px 20px rgba(38, 222, 129, 0.3); }
            50% { box-shadow: 0 8px 30px rgba(38, 222, 129, 0.5); }
        }
        
        .metrics-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .metric-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #26de81, #20bf6b, #45b7d1);
        }
        
        .metric-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 12px 40px rgba(38, 222, 129, 0.2);
        }
        
        .metric-number {
            font-size: 3.5rem;
            font-weight: bold;
            color: #26de81;
            display: block;
            margin-bottom: 0.5rem;
            text-shadow: 0 0 10px rgba(38, 222, 129, 0.3);
        }
        
        .metric-label {
            font-size: 1.1rem;
            color: #ffffff;
            font-weight: 500;
            margin-bottom: 0.5rem;
        }
        
        .metric-status {
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 0.5rem;
        }
        
        .status-excellent {
            background: linear-gradient(45deg, #26de81, #20bf6b);
            color: white;
        }
        
        .status-good {
            background: linear-gradient(45deg, #54a0ff, #2e86de);
            color: white;
        }
        
        .status-needs_improvement {
            background: linear-gradient(45deg, #feca57, #ff9f43);
            color: #2c2c2c;
        }
        
        .content-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        
        .full-width {
            grid-column: 1 / -1;
        }
        
        .section {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border-radius: 12px;
            padding: 2rem;
            border: 1px solid #333;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #26de81;
        }
        
        .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #ffffff;
        }
        
        .section-badge {
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: bold;
            background: linear-gradient(45deg, #26de81, #20bf6b);
            color: white;
        }
        
        .insight-item {
            background: linear-gradient(135deg, #242424 0%, #1a1a1a 100%);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            border-left: 4px solid #26de81;
            position: relative;
            overflow: hidden;
        }
        
        .insight-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: linear-gradient(180deg, #26de81, #20bf6b);
        }
        
        .insight-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 0.5rem;
        }
        
        .insight-description {
            color: #b0b0b0;
            margin-bottom: 1rem;
            line-height: 1.6;
        }
        
        .insight-meta {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .meta-item {
            background: #1a1a1a;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
        }
        
        .priority-high {
            background: linear-gradient(45deg, #26de81, #20bf6b);
            color: white;
        }
        
        .priority-medium {
            background: linear-gradient(45deg, #54a0ff, #2e86de);
            color: white;
        }
        
        .priority-low {
            background: linear-gradient(45deg, #feca57, #ff9f43);
            color: #2c2c2c;
        }
        
        .recommendation-item {
            background: linear-gradient(135deg, #1b2f47 0%, #1a2e1a 100%);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            border-left: 4px solid #26de81;
        }
        
        .recommendation-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 0.5rem;
        }
        
        .recommendation-details {
            color: #b0b0b0;
            margin-bottom: 1rem;
        }
        
        .recommendation-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 1rem;
        }
        
        .meta-box {
            background: rgba(255, 255, 255, 0.05);
            padding: 0.5rem;
            border-radius: 4px;
            text-align: center;
        }
        
        .meta-label {
            font-size: 0.8rem;
            color: #26de81;
            font-weight: bold;
        }
        
        .meta-value {
            color: #ffffff;
            font-weight: 500;
        }
        
        .competitive-advantages {
            background: linear-gradient(135deg, #1b2f47 0%, #1a2e1a 100%);
            border-radius: 12px;
            padding: 2rem;
            border-left: 4px solid #26de81;
        }
        
        .advantages-title {
            font-size: 1.8rem;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 1.5rem;
            text-align: center;
        }
        
        .advantage-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1rem;
        }
        
        .advantage-item {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 1rem;
            border-left: 3px solid #26de81;
            color: #e0e0e0;
            line-height: 1.6;
        }
        
        /* Animation for counters */
        @keyframes countUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-count {
            animation: countUp 0.8s ease-out forwards;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <div>
                <h1 class="team-title">${analysis.title || 'Executive Report'}</h1>
                <p class="team-subtitle">Strategic Performance Analysis</p>
            </div>
            <div class="report-date">
                <div>Generated: ${new Date().toLocaleDateString()}</div>
                <div>Records: ${data.length.toLocaleString()}</div>
            </div>
        </div>
    </div>

    <div class="container">
        <!-- Excellence Highlight -->
        <div class="excellence-highlight">
            🏆 STRATEGIC INSIGHT: ${analysis.executiveSummary || 'Performance analysis demonstrates strong operational capabilities with strategic improvement opportunities'}
        </div>

        <!-- Key Metrics Overview -->
        <div class="metrics-overview">
            ${(analysis.keyMetrics || []).map((metric, index) => `
                <div class="metric-card animate-count" style="animation-delay: ${index * 0.1}s">
                    <span class="metric-number">${metric.value}</span>
                    <span class="metric-label">${metric.label}</span>
                    <div class="metric-status status-${metric.status || 'good'}">${metric.status || 'good'}</div>
                    ${metric.businessImpact ? `<div style="font-size: 0.9rem; color: #26de81; margin-top: 0.5rem;">${metric.businessImpact}</div>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="content-grid">
            <!-- Strategic Insights -->
            ${(analysis.strategicInsights && analysis.strategicInsights.length > 0) ? `
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Strategic Insights</h2>
                    <span class="section-badge">STRATEGIC FOCUS</span>
                </div>
                
                ${analysis.strategicInsights.map(insight => `
                    <div class="insight-item">
                        <div class="insight-title">${insight.category}</div>
                        <div class="insight-description">${insight.insight}</div>
                        <div class="insight-meta">
                            <span class="meta-item priority-${insight.impact === 'high' ? 'high' : insight.impact === 'medium' ? 'medium' : 'low'}">
                                ${insight.impact.toUpperCase()} IMPACT
                            </span>
                        </div>
                        <div style="color: #26de81; font-weight: 500; margin-top: 0.5rem;">
                            → ${insight.recommendation}
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <!-- Business Recommendations -->
            ${(analysis.businessRecommendations && analysis.businessRecommendations.length > 0) ? `
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Strategic Recommendations</h2>
                    <span class="section-badge">ACTION REQUIRED</span>
                </div>
                
                ${analysis.businessRecommendations.map(rec => `
                    <div class="recommendation-item">
                        <div class="recommendation-title">${rec.action}</div>
                        <div class="recommendation-details">${rec.expectedROI}</div>
                        <div class="recommendation-meta">
                            <div class="meta-box">
                                <div class="meta-label">Priority</div>
                                <div class="meta-value">${rec.priority}</div>
                            </div>
                            <div class="meta-box">
                                <div class="meta-label">Timeline</div>
                                <div class="meta-value">${rec.timeline}</div>
                            </div>
                            <div class="meta-box">
                                <div class="meta-label">Investment</div>
                                <div class="meta-value">${rec.investment}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>

        <!-- Competitive Advantages -->
        ${(analysis.competitiveAdvantages && analysis.competitiveAdvantages.length > 0) ? `
        <div class="competitive-advantages full-width">
            <h2 class="advantages-title">Competitive Advantages & Market Position</h2>
            
            <div class="advantage-list">
                ${analysis.competitiveAdvantages.map(advantage => `
                    <div class="advantage-item">
                        <strong>✓</strong> ${advantage}
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${analysis.summary ? `
        <div class="section full-width" style="text-align: center; background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%); color: white;">
            <h2>Executive Summary</h2>
            <p style="font-size: 1.2rem; margin-top: 1rem;">${analysis.summary}</p>
        </div>
        ` : ''}
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Animate counters
            const counters = document.querySelectorAll('.metric-number');
            counters.forEach(counter => {
                const target = parseFloat(counter.textContent);
                let current = 0;
                const increment = target / 50;
                const isPercentage = counter.textContent.includes('%');
                
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    counter.textContent = isPercentage ? 
                        current.toFixed(1) + '%' : 
                        Math.floor(current);
                }, 20);
            });
            
            // Add hover effects to cards
            const cards = document.querySelectorAll('.metric-card, .section, .insight-item, .recommendation-item');
            cards.forEach(card => {
                card.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-4px)';
                });
                
                card.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                });
            });
        });
    </script>
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
    <title>${analysis.reportMetadata?.title || 'Detailed Operations Analysis'}</title>
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
        
        .performance-dashboard {
            background: linear-gradient(45deg, #26de81, #20bf6b);
            color: white;
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            text-align: center;
        }
        
        .dashboard-title {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 1rem;
        }
        
        .health-indicator {
            font-size: 1.5rem;
            font-weight: bold;
            background: rgba(255,255,255,0.2);
            padding: 1rem 2rem;
            border-radius: 25px;
            display: inline-block;
            margin: 1rem;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
            position: relative;
            overflow: hidden;
        }
        
        .metric-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #26de81, #20bf6b);
        }
        
        .metric-card:hover { transform: translateY(-4px); }
        .metric-number { font-size: 3rem; font-weight: bold; color: #26de81; display: block; margin-bottom: 0.5rem; }
        .metric-label { color: #ffffff; font-weight: 500; margin-bottom: 0.5rem; }
        .metric-status { 
            margin-top: 0.5rem; 
            padding: 0.25rem 0.75rem; 
            border-radius: 12px; 
            font-size: 0.8rem; 
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-excellent { background: #26de81; color: #000; }
        .status-good { background: #54a0ff; color: #fff; }
        .status-needs_improvement { background: #feca57; color: #000; }
        
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
            background: linear-gradient(135deg, #242424 0%, #1a1a1a 100%);
            padding: 2rem;
            border-radius: 12px;
            border-left: 4px solid #26de81;
            transition: transform 0.3s ease;
        }
        
        .sla-metric:hover {
            transform: translateY(-4px);
        }
        
        .sla-metric h3 { color: #ffffff; margin-bottom: 1rem; font-size: 1.3rem; }
        .sla-value { font-size: 2.5rem; font-weight: bold; color: #26de81; margin-bottom: 0.5rem; }
        .sla-detail { color: #b0b0b0; font-size: 0.9rem; margin-bottom: 1rem; }
        .sla-status { 
            padding: 0.5rem 1rem; 
            border-radius: 20px; 
            font-size: 0.9rem; 
            font-weight: bold; 
            text-transform: uppercase;
            display: inline-block;
        }
        
        .performance-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin: 1.5rem 0;
        }
        
        .performance-stat {
            background: #242424;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #404040;
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #26de81;
            display: block;
        }
        
        .stat-label {
            color: #b0b0b0;
            font-size: 0.9rem;
            margin-top: 0.5rem;
        }
        
        .team-member, .category-item {
            background: linear-gradient(135deg, #242424 0%, #1a1a1a 100%);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            border-left: 4px solid #54a0ff;
            transition: all 0.3s ease;
        }
        
        .team-member:hover, .category-item:hover {
            transform: translateX(5px);
            box-shadow: 0 4px 15px rgba(84, 160, 255, 0.2);
        }
        
        .member-name, .category-name { 
            font-size: 1.2rem; 
            font-weight: 600; 
            color: #ffffff; 
            margin-bottom: 0.5rem; 
        }
        
        .member-stats, .category-stats { 
            color: #b0b0b0; 
            line-height: 1.6; 
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.5rem;
        }
        
        .stat-item {
            background: rgba(255,255,255,0.05);
            padding: 0.5rem;
            border-radius: 4px;
            text-align: center;
        }
        
        .insight-item {
            background: rgba(38, 222, 129, 0.1);
            border: 1px solid rgba(38, 222, 129, 0.3);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            color: #e0e0e0;
            position: relative;
        }
        
        .insight-item::before {
            content: '💡';
            position: absolute;
            top: 1rem;
            right: 1rem;
            font-size: 1.5rem;
        }
        
        .recommendations-section {
            background: linear-gradient(135deg, #1b2f47 0%, #1a2e1a 100%);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
        }
        
        .rec-category {
            margin-bottom: 2rem;
        }
        
        .rec-category h3 {
            color: #26de81;
            font-size: 1.3rem;
            margin-bottom: 1rem;
            border-bottom: 2px solid #26de81;
            padding-bottom: 0.5rem;
        }
        
        .rec-item {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 0.8rem;
            border-left: 3px solid #26de81;
            color: #e0e0e0;
            line-height: 1.6;
        }
        
        .trend-indicator {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-left: 0.5rem;
        }
        
        .trend-stable { background: #54a0ff; color: white; }
        .trend-improving { background: #26de81; color: white; }
        .trend-declining { background: #ff4757; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${analysis.reportMetadata?.title || 'Operations Analysis'}</h1>
            <p class="subtitle">Generated: ${analysis.reportMetadata?.generatedDate || new Date().toLocaleDateString()}</p>
            <p class="subtitle">Records Analyzed: ${analysis.reportMetadata?.totalRecords || data.length}</p>
            <p class="subtitle">${analysis.reportMetadata?.dataQuality || 'Comprehensive performance analysis'}</p>
        </div>

        ${analysis.performanceOverview ? `
        <div class="performance-dashboard">
            <div class="dashboard-title">Overall Performance Health</div>
            <div class="health-indicator">${analysis.performanceOverview.overallHealth}</div>
            <div style="margin-top: 1rem; font-size: 1.1rem;">
                Trend Direction: ${analysis.performanceOverview.trendDirection}
            </div>
        </div>
        ` : ''}

        ${analysis.slaPerformance ? `
        <div class="section">
            <h2>SLA Performance Analysis</h2>
            <div class="sla-breakdown">
                <div class="sla-metric">
                    <h3>First Response SLA</h3>
                    <div class="sla-value">${analysis.slaPerformance.firstResponseSLA.complianceRate}</div>
                    <div class="sla-detail">
                        ${analysis.slaPerformance.firstResponseSLA.violations} violations out of ${analysis.slaPerformance.firstResponseSLA.totalEvaluated} tickets
                    </div>
                    <div class="sla-status status-${analysis.slaPerformance.firstResponseSLA.status?.includes('Exceeds') ? 'excellent' : analysis.slaPerformance.firstResponseSLA.status?.includes('Meets') ? 'good' : 'needs_improvement'}">
                        ${analysis.slaPerformance.firstResponseSLA.status}
                    </div>
                    <div style="margin-top: 1rem; color: #b0b0b0; font-size: 0.9rem;">
                        Gap to Benchmark: ${analysis.slaPerformance.firstResponseSLA.performanceGap}
                    </div>
                </div>
                <div class="sla-metric">
                    <h3>Resolution SLA</h3>
                    <div class="sla-value">${analysis.slaPerformance.resolutionSLA.complianceRate}</div>
                    <div class="sla-detail">
                        ${analysis.slaPerformance.resolutionSLA.violations} violations out of ${analysis.slaPerformance.resolutionSLA.totalEvaluated} tickets
                    </div>
                    <div class="sla-status status-${analysis.slaPerformance.resolutionSLA.status?.includes('Exceeds') ? 'excellent' : analysis.slaPerformance.resolutionSLA.status?.includes('Meets') ? 'good' : 'needs_improvement'}">
                        ${analysis.slaPerformance.resolutionSLA.status}
                    </div>
                    <div style="margin-top: 1rem; color: #b0b0b0; font-size: 0.9rem;">
                        Gap to Benchmark: ${analysis.slaPerformance.resolutionSLA.performanceGap}
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.teamPerformance ? `
        <div class="section">
            <h2>Team Performance Overview</h2>
            <div class="performance-grid">
                <div class="performance-stat">
                    <span class="stat-number">${analysis.teamPerformance.totalAgents}</span>
                    <div class="stat-label">Active Agents</div>
                </div>
                <div class="performance-stat">
                    <span class="stat-number">${analysis.teamPerformance.averageTicketsPerAgent}</span>
                    <div class="stat-label">Avg Tickets/Agent</div>
                </div>
                <div class="performance-stat">
                    <span class="stat-number">${analysis.teamPerformance.performanceDistribution?.excellentPerformers || 0}</span>
                    <div class="stat-label">Top Performers</div>
                </div>
                <div class="performance-stat">
                    <span class="stat-number">${analysis.teamPerformance.performanceDistribution?.needsImprovement || 0}</span>
                    <div class="stat-label">Need Development</div>
                </div>
            </div>
            
            <h3 style="color: #26de81; margin: 2rem 0 1rem 0;">Top Performing Agents</h3>
            ${(analysis.teamPerformance.topPerformers || []).map(agent => `
                <div class="team-member">
                    <div class="member-name">${agent.agent}</div>
                    <div class="member-stats">
                        <div class="stat-item">
                            <strong>${agent.totalTickets}</strong><br>
                            <small>Total Tickets</small>
                        </div>
                        <div class="stat-item">
                            <strong>${agent.violationRate}</strong><br>
                            <small>Violation Rate</small>
                        </div>
                        <div class="stat-item">
                            <strong>${agent.performance}</strong><br>
                            <small>Performance</small>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${(analysis.categoryAnalysis && analysis.categoryAnalysis.length > 0) ? `
        <div class="section">
            <h2>Category Performance Analysis</h2>
            ${analysis.categoryAnalysis.map(category => `
                <div class="category-item">
                    <div class="category-name">${category.category}</div>
                    <div class="category-stats">
                        <div class="stat-item">
                            <strong>${category.volume}</strong><br>
                            <small>Total Volume</small>
                        </div>
                        <div class="stat-item">
                            <strong>${category.percentage}</strong><br>
                            <small>% of Total</small>
                        </div>
                        <div class="stat-item">
                            <strong>${category.responseViolations}</strong><br>
                            <small>Response Violations</small>
                        </div>
                        <div class="stat-item">
                            <strong>${category.overallHealth}</strong><br>
                            <small>Health Status</small>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${(analysis.operationalInsights && analysis.operationalInsights.length > 0) ? `
        <div class="section">
            <h2>Key Operational Insights</h2>
            ${analysis.operationalInsights.map(insight => `
                <div class="insight-item">${insight}</div>
            `).join('')}
        </div>
        ` : ''}

        ${(analysis.actionableRecommendations && analysis.actionableRecommendations.length > 0) ? `
        <div class="recommendations-section">
            <h2 style="color: #ffffff; margin-bottom: 2rem; text-align: center; font-size: 2rem;">Strategic Action Plan</h2>
            ${analysis.actionableRecommendations.map(recCategory => `
                <div class="rec-category">
                    <h3>${recCategory.category}</h3>
                    ${recCategory.items.map(item => `
                        <div class="rec-item">→ ${item}</div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
        ` : ''}
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Animate counters
            const counters = document.querySelectorAll('.metric-number, .sla-value, .stat-number');
            counters.forEach(counter => {
                const target = parseFloat(counter.textContent);
                let current = 0;
                const increment = target / 50;
                const isPercentage = counter.textContent.includes('%');
                
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    counter.textContent = isPercentage ? 
                        current.toFixed(1) + '%' : 
                        Math.floor(current);
                }, 20);
            });
            
            // Add progressive disclosure for large lists
            const membersList = document.querySelectorAll('.team-member');
            if (membersList.length > 5) {
                membersList.forEach((member, index) => {
                    if (index >= 5) {
                        member.style.display = 'none';
                    }
                });
                
                // Add show more button
                const showMoreBtn = document.createElement('button');
                showMoreBtn.textContent = 'Show All Team Members';
                showMoreBtn.style.cssText = 'background: #26de81; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; margin: 1rem 0;';
                
                showMoreBtn.onclick = function() {
                    membersList.forEach(member => member.style.display = 'block');
                    this.style.display = 'none';
                };
                
                if (membersList.length > 0) {
                    membersList[4].after(showMoreBtn);
                }
            }
        });
    </script>
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
    <title>${analysis.presentationTitle || 'Performance Presentation'}</title>
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
            min-height: 600px;
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
        
        .title-slide {
            background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%);
            color: white;
            text-align: center;
            border-top: 5px solid #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        
        .title-slide h1 { color: white; font-size: 3.5em; }
        .title-slide .subtitle { font-size: 1.5em; margin: 20px 0 40px 0; opacity: 0.9; }
        
        .key-stat {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 30px;
            margin: 20px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            min-width: 200px;
            text-align: center;
            transition: transform 0.3s ease;
        }
        
        .key-stat:hover {
            transform: scale(1.05);
        }
        
        .key-stat .number { font-size: 3em; font-weight: bold; display: block; margin-bottom: 10px; }
        .key-stat .label { font-size: 1.1em; opacity: 0.9; }
        
        .metrics-showcase {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin: 30px 0;
        }
        
        .metric-display {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #ffffff;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            border: 1px solid #333;
            transform: translateY(0);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .metric-display::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #26de81, #20bf6b, #45b7d1);
        }
        
        .metric-display:hover { 
            transform: translateY(-8px); 
            box-shadow: 0 15px 30px rgba(38, 222, 129, 0.2);
        }
        
        .metric-display .big-number {
            font-size: 3em;
            font-weight: bold;
            display: block;
            margin-bottom: 15px;
            color: #26de81;
            text-shadow: 0 0 10px rgba(38, 222, 129, 0.3);
        }
        
        .metric-display .metric-name {
            font-size: 1.2em;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .status-indicator {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 10px;
        }
        
        .status-excellent {
            background: linear-gradient(45deg, #26de81, #20bf6b);
            color: white;
        }
        
        .status-good {
            background: linear-gradient(45deg, #54a0ff, #2e86de);
            color: white;
        }
        
        .status-needs_improvement {
            background: linear-gradient(45deg, #feca57, #ff9f43);
            color: #2c2c2c;
        }
        
        .insight-highlight {
            background: rgba(38, 222, 129, 0.1);
            border: 1px solid rgba(38, 222, 129, 0.3);
            border-radius: 10px;
            padding: 25px;
            margin: 25px 0;
        }
        .insight-highlight h4 { color: #26de81; margin-bottom: 15px; font-size: 1.3em; }
        .insight-list { list-style: none; }
        .insight-list li {
            margin: 12px 0;
            padding-left: 25px;
            position: relative;
            font-size: 1.1em;
        }
        .insight-list li:before {
            content: "→";
            color: #26de81;
            font-weight: bold;
            position: absolute;
            left: 0;
            font-size: 1.2em;
        }
        
        .action-showcase {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
            margin: 30px 0;
        }
        
        .action-card {
            background: linear-gradient(135deg, #242424 0%, #1a1a1a 100%);
            border-radius: 12px;
            padding: 25px;
            border-left: 5px solid #26de81;
            transition: all 0.3s ease;
        }
        
        .action-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(38, 222, 129, 0.15);
        }
        
        .action-priority {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 15px;
        }
        
        .priority-high {
            background: linear-gradient(45deg, #26de81, #20bf6b);
            color: white;
        }
        
        .priority-medium {
            background: linear-gradient(45deg, #54a0ff, #2e86de);
            color: white;
        }
        
        .action-title {
            font-size: 1.3em;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 10px;
        }
        
        .action-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }
        
        .meta-item {
            background: rgba(255, 255, 255, 0.05);
            padding: 8px;
            border-radius: 5px;
            text-align: center;
            font-size: 0.9em;
        }
        
        .meta-label {
            color: #26de81;
            font-weight: bold;
            font-size: 0.8em;
            text-transform: uppercase;
        }
        
        .navigation {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .nav-btn {
            background: rgba(38, 222, 129, 0.9);
            border: none;
            padding: 12px 16px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: bold;
            color: white;
            transition: all 0.3s ease;
            font-size: 0.9em;
        }
        .nav-btn:hover {
            background: #20bf6b;
            transform: scale(1.05);
            box-shadow: 0 5px 15px rgba(38, 222, 129, 0.3);
        }
        
        .summary-card {
            background: linear-gradient(45deg, #ff4757, #ff3742);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            text-align: center;
            font-weight: bold;
            animation: pulse-glow 3s ease-in-out infinite;
            font-size: 1.2em;
        }
        
        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 20px rgba(255, 71, 87, 0.3); }
            50% { box-shadow: 0 0 40px rgba(255, 71, 87, 0.6); }
        }
        
        .slide-counter {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: rgba(38, 222, 129, 0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="navigation">
        <button class="nav-btn" onclick="scrollToSlide(0)">Title</button>
        ${(analysis.slides || []).map((_, index) => `
            <button class="nav-btn" onclick="scrollToSlide(${index + 1})">Slide ${index + 1}</button>
        `).join('')}
        <button class="nav-btn" onclick="scrollToSlide(${(analysis.slides || []).length + 1})">Summary</button>
    </div>

    <div class="presentation-container">
        <!-- Title Slide -->
        <div class="slide title-slide" id="slide-0">
            <div class="slide-counter">Slide 1 of ${(analysis.slides || []).length + 2}</div>
            <h1>${analysis.presentationTitle || 'Performance Excellence'}</h1>
            <p class="subtitle">${analysis.executiveMessage || 'Strategic Performance Analysis'}</p>
            <p style="font-size: 1.2em; margin-bottom: 40px;">${data.length.toLocaleString()} Records Analyzed</p>
            
            <div style="display: flex; justify-content: center; flex-wrap: wrap;">
                <div class="key-stat">
                    <span class="number">${data.length}</span>
                    <span class="label">Total Tickets</span>
                </div>
                <div class="key-stat">
                    <span class="number">${new Date().toLocaleDateString()}</span>
                    <span class="label">Analysis Date</span>
                </div>
            </div>
        </div>

        ${(analysis.slides || []).map((slide, index) => `
            <div class="slide" id="slide-${index + 1}">
                <div class="slide-counter">Slide ${index + 2} of ${(analysis.slides || []).length + 2}</div>
                <h2>${slide.title}</h2>
                ${slide.content.headline ? `
                    <div style="font-size: 1.3em; margin: 25px 0; color: #20bf6b; text-align: center;">
                        ${slide.content.headline}
                    </div>
                ` : ''}
                
                ${slide.type === 'metrics_overview' && slide.content.keyMetrics ? `
                    <div class="metrics-showcase">
                        ${slide.content.keyMetrics.map(metric => `
                            <div class="metric-display">
                                <span class="big-number">${metric.value}</span>
                                <div class="metric-name">${metric.metric}</div>
                                <div class="status-indicator status-${metric.status}">${metric.status}</div>
                                ${metric.benchmark ? `<div style="font-size: 0.9em; color: #b0b0b0; margin-top: 10px;">Target: ${metric.benchmark}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${slide.type === 'team_breakdown' && slide.content.teamMetrics ? `
                    <div class="metrics-showcase">
                        ${slide.content.teamMetrics.map(metric => `
                            <div class="metric-display">
                                <span class="big-number">${metric.value}</span>
                                <div class="metric-name">${metric.metric}</div>
                                <div style="font-size: 0.9em; color: #b0b0b0; margin-top: 10px;">${metric.context}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${slide.type === 'action_plan' && slide.content.strategicActions ? `
                    <div class="action-showcase">
                        ${slide.content.strategicActions.map(action => `
                            <div class="action-card">
                                <div class="action-priority priority-${action.priority.toLowerCase()}">${action.priority} Priority</div>
                                <div class="action-title">${action.action}</div>
                                <div class="action-meta">
                                    <div class="meta-item">
                                        <div class="meta-label">Timeline</div>
                                        <div>${action.timeline}</div>
                                    </div>
                                    <div class="meta-item">
                                        <div class="meta-label">Investment</div>
                                        <div>${action.investment}</div>
                                    </div>
                                    <div class="meta-item">
                                        <div class="meta-label">Impact</div>
                                        <div>${action.impact.substring(0, 20)}...</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${slide.content.insights && slide.content.insights.length > 0 ? `
                    <div class="insight-highlight">
                        <h4>Key Insights</h4>
                        <ul class="insight-list">
                            ${slide.content.insights.map(insight => `<li>${insight}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `).join('')}

        <div class="slide" id="slide-${(analysis.slides || []).length + 1}">
            <div class="slide-counter">Slide ${(analysis.slides || []).length + 2} of ${(analysis.slides || []).length + 2}</div>
            <h2>Executive Summary & Next Steps</h2>
            
            ${analysis.executiveSummary ? `
                <div class="insight-highlight">
                    <h4>Key Message</h4>
                    <p style="font-size: 1.2em; line-height: 1.6;">${analysis.executiveSummary.keyMessage}</p>
                </div>
                
                <div class="insight-highlight">
                    <h4>Business Impact</h4>
                    <p style="font-size: 1.1em; line-height: 1.6;">${analysis.executiveSummary.businessImpact}</p>
                </div>
                
                <div class="insight-highlight">
                    <h4>Next Steps</h4>
                    <p style="font-size: 1.1em; line-height: 1.6;">${analysis.executiveSummary.nextSteps}</p>
                </div>
            ` : ''}
            
            <div class="summary-card">
                🎯 ${analysis.executiveSummary?.keyMessage || 'Strategic performance analysis complete - ready for action'}
            </div>
            
            <div style="text-align: center; margin-top: 40px;">
                <p style="font-size: 1.1em; color: #b0b0b0;">
                    Analysis based on ${data.length.toLocaleString()} support interactions
                </p>
                <p style="font-size: 1em; color: #26de81; margin-top: 10px;">
                    ${analysis.appendix?.confidence || 'High confidence analysis'} • ${analysis.appendix?.analysisMethod || 'Comprehensive review methodology'}
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

        // Keyboard navigation
        document.addEventListener('keydown', function(e) {
            const totalSlides = ${(analysis.slides || []).length + 2};
            const currentSlide = getCurrentSlideNumber();
            
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                if (currentSlide < totalSlides - 1) {
                    scrollToSlide(currentSlide + 1);
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (currentSlide > 0) {
                    scrollToSlide(currentSlide - 1);
                }
            }
        });
        
        function getCurrentSlideNumber() {
            const slides = document.querySelectorAll('.slide');
            for (let i = 0; i < slides.length; i++) {
                const rect = slides[i].getBoundingClientRect();
                if (rect.top >= -100 && rect.top <= 100) {
                    return i;
                }
            }
            return 0;
        }

        // Add interactive animations
        document.addEventListener('DOMContentLoaded', function() {
            // Animate counters when they come into view
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const counter = entry.target;
                        const target = parseFloat(counter.textContent);
                        let current = 0;
                        const increment = target / 50;
                        const isPercentage = counter.textContent.includes('%');
                        
                        const timer = setInterval(() => {
                            current += increment;
                            if (current >= target) {
                                current = target;
                                clearInterval(timer);
                            }
                            counter.textContent = isPercentage ? 
                                current.toFixed(1) + '%' : 
                                Math.floor(current);
                        }, 20);
                    }
                });
            });

            document.querySelectorAll('.big-number, .number').forEach(counter => {
                observer.observe(counter);
            });
        });
    </script>
</body>
</html>`;
}

module.exports = app;