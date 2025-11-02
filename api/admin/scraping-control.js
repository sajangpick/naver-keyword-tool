/**
 * ADLOG 스크래핑 제어 API
 * 어드민에서 스크래핑을 실행하고 관리
 */

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Python 스크래퍼 실행
router.post('/run-scraping', async (req, res) => {
    try {
        console.log('🚀 스크래핑 시작 요청');
        
        // Python 스크립트 경로
        const scriptPath = path.join(__dirname, '../../scraping/adlog_full_scraper.py');
        
        // Python 실행
        const pythonProcess = spawn('python', [scriptPath], {
            cwd: path.join(__dirname, '../../scraping')
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
            console.log(`Python: ${data}`);
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error(`Python Error: ${data}`);
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                res.json({
                    success: true,
                    message: '스크래핑 완료',
                    output: output
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: '스크래핑 실패',
                    error: errorOutput
                });
            }
        });
        
    } catch (error) {
        console.error('스크래핑 오류:', error);
        res.status(500).json({
            success: false,
            message: '스크래핑 실행 오류',
            error: error.message
        });
    }
});

// 스크래핑 상태 확인
router.get('/scraping-status', async (req, res) => {
    try {
        // 최근 수집 데이터 확인
        const dataPath = path.join(__dirname, '../../scraping/data');
        const files = fs.readdirSync(dataPath);
        
        const stats = files.map(file => {
            const filePath = path.join(dataPath, file);
            const stat = fs.statSync(filePath);
            return {
                name: file,
                size: stat.size,
                modified: stat.mtime
            };
        });
        
        res.json({
            success: true,
            files: stats,
            lastUpdate: stats.length > 0 ? stats[0].modified : null
        });
        
    } catch (error) {
        res.json({
            success: false,
            message: '상태 확인 실패',
            error: error.message
        });
    }
});

// 수집된 데이터 다운로드
router.get('/download-data/:type', (req, res) => {
    try {
        const { type } = req.params;
        let fileName;
        
        switch(type) {
            case 'restaurants':
                fileName = 'restaurants.csv';
                break;
            case 'rankings':
                fileName = 'rankings.csv';
                break;
            case 'json':
                fileName = 'restaurants_list.json';
                break;
            default:
                return res.status(400).json({ error: '잘못된 파일 타입' });
        }
        
        const filePath = path.join(__dirname, '../../scraping/data', fileName);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
        }
        
        res.download(filePath, fileName);
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 스크래핑 스케줄 설정
router.post('/set-schedule', async (req, res) => {
    try {
        const { schedule } = req.body; // daily, weekly, manual
        
        // 스케줄 설정 로직
        // 실제로는 node-cron 또는 시스템 cron 설정
        
        res.json({
            success: true,
            message: `스케줄 설정: ${schedule}`
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
