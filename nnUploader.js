const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

const uploadPath = 'E:/upload';

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let subFolder = req.body.subFolder || '';
        // 如果上传的是图片，则存储到 /upload/image 目录下；如果上传的是视频，则存储到 /upload/video 目录下
        const fileExt = path.extname(file.originalname).toLowerCase();
        if (fileExt === '.jpg' || fileExt === '.jpeg' || fileExt === '.png' || fileExt === '.gif') {
            subFolder = path.join(subFolder, 'image');
        } else if (fileExt === '.mp4' || fileExt === '.avi' || fileExt === '.mov' || fileExt === '.wmv') {
            subFolder = path.join(subFolder, 'video');
        }
        const folderPath = path.join(uploadPath, subFolder);
        if (!fs.existsSync(folderPath)) {
            try {
                fs.mkdirSync(folderPath, { recursive: true });
            } catch (error) {
                return cb(error);
            }
        }
        cb(null, folderPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 100, // 最大允许上传 100MB 的文件
    },
});

app.post('/upload', upload.any(), function (req, res, next) {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send({
            success: false,
            message: '未上传任何文件',
        });
    }

    const uploadedFiles = [];
    const duplicates = [];
    req.files.forEach((file) => {
        if (uploadedFiles.some((f) => f.originalname === file.originalname)) {
            duplicates.push(file.originalname);
            fs.unlinkSync(file.path);
        } else {
            uploadedFiles.push({
                originalname: file.originalname,
                path: file.path,
            });
        }
    });

    if (duplicates.length > 0) {
        return res.status(400).send({
            success: false,
            message: `以下文件已存在，请不要重复上传：${duplicates.join(', ')}`,
        });
    }

    // 合并分片
    const filePaths = uploadedFiles.map(f => f.path);
    const destPath = path.join(uploadPath, req.body.subFolder, uploadedFiles[0].originalname); // 合并后的文件路径为第一个分片所在的路径
    mergeChunks(filePaths, destPath);

    res.send({
        success: true,
        message: '文件上传成功',
        files: uploadedFiles,
    });
});

function mergeChunks(filePaths, destPath) {
    const writeStream = fs.createWriteStream(destPath, { flags: 'a' });
    let i = 0;

    function write() {
        const readStream = fs.createReadStream(filePaths[i]);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', () => {
            fs.unlinkSync(filePaths[i]);
            i++;
            if (i < filePaths.length) {
                write();
            } else {
                writeStream.end();
            }
        });
    }

    write();
}

app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send({
        success: false,
        message: '服务器内部错误',
    });
});

app.listen(327, function () {
    console.log('服务器已启动，端口：327');
});