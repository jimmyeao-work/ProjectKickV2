const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

/**
 * Data validation and cleaning utilities
 */
class DataUtils {
    /**
     * Clean and validate CSV data
     * @param {Array} data - Raw CSV data
     * @returns {Object} - Cleaned data with validation info
     */
    static cleanData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return { data: [], errors: ['No data provided'], warnings: [] };
        }

        const errors = [];
        const warnings = [];
        const cleanedData = [];

        // Get column names from first row
        const columns = Object.keys(data[0]);
        
        if (columns.length === 0) {
            errors.push('No columns detected in data');
            return { data: [], errors, warnings };
        }

        // Process each row
        data.forEach((row, index) => {
            const cleanedRow = {};
            let hasValidData = false;

            columns.forEach(col => {
                let value = row[col];
                
                // Handle null/undefined values
                if (value === null || value === undefined || value === '') {
                    cleanedRow[col] = null;
                } else {
                    // Convert to appropriate type
                    cleanedRow[col] = this.convertValue(value);
                    hasValidData = true;
                }
            });

            // Only include rows with at least some valid data
            if (hasValidData) {
                cleanedData.push(cleanedRow);
            } else {
                warnings.push(`Row ${index + 1} contains no valid data`);
            }
        });

        // Data quality checks
        if (cleanedData.length < data.length * 0.8) {
            warnings.push('More than 20% of rows were filtered out due to data quality issues');
        }

        return {
            data: cleanedData,
            errors,
            warnings,
            originalCount: data.length,
            cleanedCount: cleanedData.length
        };
    }

    /**
     * Convert string values to appropriate types
     * @param {*} value - Value to convert
     * @returns {*} - Converted value
     */
    static convertValue(value) {
        if (typeof value !== 'string') return value;

        const trimmed = value.trim();
        
        // Check for numbers
        if (/^\d+$/.test(trimmed)) {
            return parseInt(trimmed, 10);
        }
        
        if (/^\d*\.\d+$/.test(trimmed)) {
            return parseFloat(trimmed);
        }

        // Check for dates
        const dateValue = moment(trimmed, ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD HH:mm:ss'], true);
        if (dateValue.isValid()) {
            return dateValue.toISOString();
        }

        // Check for booleans
        const lowerValue = trimmed.toLowerCase();
        if (['true', 'yes', '1', 'y'].includes(lowerValue)) return true;
        if (['false', 'no', '0', 'n'].includes(lowerValue)) return false;

        return trimmed;
    }

    /**
     * Analyze data patterns and suggest improvements
     * @param {Array} data - Data to analyze
     * @returns {Object} - Analysis results
     */
    static analyzeDataQuality(data) {
        if (!data || data.length === 0) {
            return { quality: 'poor', suggestions: ['No data to analyze'] };
        }

        const columns = Object.keys(data[0]);
        const analysis = {
            totalRows: data.length,
            totalColumns: columns.length,
            columnAnalysis: {},
            suggestions: [],
            quality: 'good'
        };

        // Analyze each column
        columns.forEach(col => {
            const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined);
            const nullCount = data.length - values.length;
            const uniqueCount = new Set(values).size;
            
            analysis.columnAnalysis[col] = {
                nullCount,
                nullPercentage: (nullCount / data.length) * 100,
                uniqueCount,
                uniquePercentage: (uniqueCount / values.length) * 100,
                dataType: this.inferDataType(values),
                sampleValues: values.slice(0, 5)
            };

            // Quality suggestions
            if (nullCount > data.length * 0.5) {
                analysis.suggestions.push(`Column "${col}" has more than 50% missing values`);
                analysis.quality = 'warning';
            }

            if (uniqueCount === 1 && values.length > 1) {
                analysis.suggestions.push(`Column "${col}" has the same value for all rows`);
            }
        });

        // Overall quality assessment
        if (data.length < 10) {
            analysis.quality = 'poor';
            analysis.suggestions.push('Dataset is very small (less than 10 rows)');
        } else if (data.length < 100) {
            analysis.quality = 'warning';
            analysis.suggestions.push('Dataset is small (less than 100 rows) - insights may be limited');
        }

        return analysis;
    }

    /**
     * Infer data type from array of values
     * @param {Array} values - Array of values
     * @returns {string} - Inferred data type
     */
    static inferDataType(values) {
        if (values.length === 0) return 'unknown';

        const types = values.map(val => typeof val);
        const uniqueTypes = [...new Set(types)];

        if (uniqueTypes.length === 1) {
            const type = uniqueTypes[0];
            
            // Check for dates in strings
            if (type === 'string') {
                const sampleValues = values.slice(0, 10);
                const dateCount = sampleValues.filter(val => moment(val, moment.ISO_8601, true).isValid()).length;
                if (dateCount > sampleValues.length * 0.7) {
                    return 'date';
                }
            }
            
            return type;
        }

        return 'mixed';
    }
}

/**
 * Report generation utilities
 */
class ReportUtils {
    /**
     * Generate report metadata
     * @param {string} reportType - Type of report
     * @param {Object} dataStructure - Data structure info
     * @returns {Object} - Report metadata
     */
    static generateMetadata(reportType, dataStructure) {
        return {
            id: this.generateId(),
            type: reportType,
            generatedAt: new Date().toISOString(),
            dataRows: dataStructure.totalRows,
            dataColumns: dataStructure.columns.length,
            capabilities: {
                timeAnalysis: dataStructure.hasDateColumns,
                userAnalysis: dataStructure.hasUserColumns,
                statusAnalysis: dataStructure.hasStatusColumns
            }
        };
    }

    /**
     * Generate unique ID
     * @returns {string} - Unique ID
     */
    static generateId() {
        return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up old reports
     * @param {string} reportsDir - Reports directory
     * @param {number} maxAgeHours - Maximum age in hours
     */
    static async cleanupOldReports(reportsDir, maxAgeHours = 24) {
        try {
            const reportsPath = path.resolve(reportsDir);
            if (!await fs.pathExists(reportsPath)) return;

            const files = await fs.readdir(reportsPath);
            const now = Date.now();
            const maxAge = maxAgeHours * 60 * 60 * 1000;

            for (const file of files) {
                const filePath = path.join(reportsPath, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.remove(filePath);
                    console.log(`Cleaned up old report: ${file}`);
                }
            }
        } catch (error) {
            console.error('Error cleaning up old reports:', error);
        }
    }
}

/**
 * Error handling utilities
 */
class ErrorUtils {
    /**
     * Create standardized error response
     * @param {string} message - Error message
     * @param {string} code - Error code
     * @param {number} status - HTTP status code
     * @returns {Object} - Error response
     */
    static createError(message, code = 'GENERAL_ERROR', status = 500) {
        return {
            error: true,
            message,
            code,
            status,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Handle Claude API errors
     * @param {Error} error - Claude API error
     * @returns {Object} - Formatted error response
     */
    static handleClaudeError(error) {
        console.error('Claude API Error:', error);

        if (error.status === 401) {
            return this.createError('Invalid Claude API key', 'INVALID_API_KEY', 401);
        }
        
        if (error.status === 429) {
            return this.createError('Claude API rate limit exceeded', 'RATE_LIMIT', 429);
        }
        
        if (error.status === 400) {
            return this.createError('Invalid request to Claude API', 'INVALID_REQUEST', 400);
        }

        return this.createError('Claude API service unavailable', 'SERVICE_UNAVAILABLE', 503);
    }

    /**
     * Handle file upload errors
     * @param {Error} error - Upload error
     * @returns {Object} - Formatted error response
     */
    static handleUploadError(error) {
        console.error('Upload Error:', error);

        if (error.code === 'LIMIT_FILE_SIZE') {
            return this.createError('File too large (max 10MB)', 'FILE_TOO_LARGE', 413);
        }
        
        if (error.code === 'LIMIT_FILE_COUNT') {
            return this.createError('Too many files uploaded', 'TOO_MANY_FILES', 400);
        }
        
        if (error.message.includes('Only CSV files are allowed')) {
            return this.createError('Invalid file type - CSV files only', 'INVALID_FILE_TYPE', 400);
        }

        return this.createError('File upload failed', 'UPLOAD_ERROR', 500);
    }
}

/**
 * Performance monitoring utilities
 */
class PerformanceUtils {
    /**
     * Create performance timer
     * @param {string} label - Timer label
     * @returns {Function} - Function to end timer
     */
    static startTimer(label) {
        const start = process.hrtime.bigint();
        
        return () => {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000; // Convert to milliseconds
            console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);
            return duration;
        };
    }

    /**
     * Log memory usage
     * @param {string} label - Label for memory check
     */
    static logMemoryUsage(label = 'Memory Usage') {
        const usage = process.memoryUsage();
        console.log(`💾 ${label}:`, {
            rss: `${Math.round(usage.rss / 1024 / 1024 * 100) / 100} MB`,
            heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
            heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
            external: `${Math.round(usage.external / 1024 / 1024 * 100) / 100} MB`
        });
    }
}

module.exports = {
    DataUtils,
    ReportUtils,
    ErrorUtils,
    PerformanceUtils
};