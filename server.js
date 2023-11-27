const express = require('express');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const fs = require('fs');
const cors = require('cors');

app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage: storage });

app.get('/download/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'uploads', fileName);

    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } else {
        res.status(404).send('File not found');
    }
});

app.get('/files', (req, res) => {
    res.json(uploadedFiles);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

app.post('/upload', upload.single('excelFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    uploadedFiles.push(req.file.originalname);
    res.send('File uploaded successfully!');
}, (error, req, res, next) => {
    console.error('Error during file upload:', error);
    res.status(500).send('Internal Server Error');
});

app.delete('/files/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'uploads', fileName);

    console.log(`Received DELETE request for file: ${fileName}`);

    if (fs.existsSync(filePath)) {
        console.log(`Attempting to delete file: ${filePath}`);

        uploadedFiles = uploadedFiles.filter(file => file !== fileName);

        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                res.status(500).send('Internal Server Error');
            } else {
                console.log(`File deleted successfully: ${filePath}`);
                res.send('File deleted successfully!');
            }
        });
    } else {
        console.log(`File not found: ${filePath}`);
        res.status(404).send('File not found');
    }
});

function readExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const data = xlsx.utils.sheet_to_json(sheet);

    return data;
}

function validateSkill(user1Skill, user2Skill) {
    return user1Skill === user2Skill;
}

function validateWorkDays(user1Data, user2Data) {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (const day of daysOfWeek) {
        if (
            (user1Data[day] === 'Shift' && user2Data[day] === 'Shift') ||
            (user1Data[day] === 'Off' && user2Data[day] === 'Off')
        ) {
            return false;
        }
    }

    return true;
}

function calculateHoursBetweenShifts(oldSchedule, newSchedule) {
    const [oldShiftStart, oldShiftEnd] = oldSchedule.split('-').map(time => time.trim());
    const [newShiftStart, newShiftEnd] = newSchedule.split('-').map(time => time.trim());

    const oldShiftStartDate = new Date(`2000-01-01T${oldShiftStart}`);
    const oldShiftEndDate = new Date(`2000-01-01T${oldShiftEnd}`);
    const newShiftStartDate = new Date(`2000-01-01T${newShiftStart}`);
    const newShiftEndDate = new Date(`2000-01-01T${newShiftEnd}`);

    const hoursBetweenShifts = Math.abs(newShiftStartDate - oldShiftEndDate) / (1000 * 60 * 60);

    return hoursBetweenShifts;
}

function canSwap(user1Data, user2Data) {
    console.log('User 1 Home Skill:', user1Data['Home Skill']);
    console.log('User 2 Home Skill:', user2Data['Home Skill']);

    if (user1Data['Home Skill'] !== user2Data['Home Skill']) {
        console.log('Skills are different');
        return {
            valid: false,
            reason: `Swap is not valid. Users don't have the same Home Skill. User 1 has '${user1Data['Home Skill']}', and User 2 has '${user2Data['Home Skill']}'`,
        };
    }

    const user1OldSchedule = user1Data['Schedule'];
    const user1NewSchedule = user2Data['Schedule'];

    const user2OldSchedule = user2Data['Schedule'];
    const user2NewSchedule = user1Data['Schedule'];

    const user1HoursBetweenShifts = calculateHoursBetweenShifts(user1OldSchedule, user1NewSchedule);
    const user2HoursBetweenShifts = calculateHoursBetweenShifts(user2OldSchedule, user2NewSchedule);

    if (user1HoursBetweenShifts < 12 || user2HoursBetweenShifts < 12) {
        return {
            valid: false,
            reason: 'Swap is not valid. One of the users will have less than 12 hours off between shifts',
        };
    }

    return {
        valid: true,
        reason: 'Swap is valid',
    };
}

function calculateDaysInARow(weekOff, oldSchedule, newSchedule) {
    const oldScheduleDays = oldSchedule.split('-');
    const newScheduleDays = newSchedule.split('-');

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const weekOffStartIndex = daysOfWeek.indexOf(weekOff);
    const oldWorkdays = daysOfWeek.filter((day) => !oldScheduleDays.includes(day));
    const newWorkdays = daysOfWeek.filter((day) => !newScheduleDays.includes(day));

    let oldDaysInARow = 0;
    let newDaysInARow = 0;

    for (let i = weekOffStartIndex; i < daysOfWeek.length; i++) {
        if (oldWorkdays.includes(daysOfWeek[i])) {
            oldDaysInARow++;
        } else {
            break;
        }
    }

    for (let i = weekOffStartIndex; i < daysOfWeek.length; i++) {
        if (newWorkdays.includes(daysOfWeek[i])) {
            newDaysInARow++;
        } else {
            break;
        }
    }

    return oldDaysInARow + newDaysInARow;
}
function processFilesInFolder(folderPath, username1, username2) {
    return new Promise((resolve, reject) => {
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                console.error('Error reading folder:', err);
                reject(err);
                return;
            }

            let user1Data;
            let user2Data;

            files.forEach((file) => {
                const filePath = path.join(folderPath, file);

                if (path.extname(filePath).toLowerCase() === '.xlsx') {
                    const excelData = readExcel(filePath);
                    console.log('Excel Data:', excelData);

                    const user1 = excelData.find((entry) => entry['Login'] === username1);
                    const user2 = excelData.find((entry) => entry['Login'] === username2);

                    if (user1) {
                        user1Data = user1;
                    }

                    if (user2) {
                        user2Data = user2;
                    }
                }
            });

            resolve({ user1Data, user2Data });
        });
    });
}

let uploadedFiles = [];

// uploads folder path "guide"
const uploadsFolderPath = path.join(__dirname, 'uploads');
app.post('/run-server-script', async (req, res) => {
    try {
        const username1 = req.body.username1;
        const username2 = req.body.username2;

        console.log('Received usernames:', username1, username2);

        const { user1Data, user2Data } = await processFilesInFolder(uploadsFolderPath, username1, username2);

        if (!user1Data || !user2Data) {
            res.json({
                message: 'Server script executed successfully',
                user1Found: !!user1Data,
                user2Found: !!user2Data,
            });
            return;
        }
    
        // Call the function to determine if the swap is valid
        const swapResult = canSwap(user1Data, user2Data);
        
         // Include the rejection reason in the response
         if (!swapResult.valid) {
            res.json({
                message: 'Swap Rejected',
                user1Found: true,
                user2Found: true,
                reason: swapResult.reason, // Include the rejection reason here
            });
        } else {
            res.json({
                message: 'Server script executed successfully',
                user1Found: true,
                user2Found: true,
            });
        }
    } catch (error) {
        console.error('Error during file processing:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
