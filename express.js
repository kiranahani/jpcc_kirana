const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({storage: storage, limits: { fieldSize : 3145728 }})

dotenv.config();

const app = express();

// Enable CORS for all routes
app.use(cors());

app.use(express.json());
app.use(express.static('public'));

const DALLE_API_KEY = process.env.DALLE_API_KEY;
if (!DALLE_API_KEY) {
    console.error('DALL-E API key is not set in .env file');
    process.exit(1);
}

const db = new sqlite3.Database('api_usage.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`
            CREATE TABLE IF NOT EXISTS api_usage (
                date TEXT PRIMARY KEY,
                count INTEGER
            )
        `);
    }
});

const dateLimits = {
    '2023-12-04': 10,
    '2023-12-05': 1,
    '2023-12-06': 100
};

/**
 * Save error message to a log file
 * @param {string} message Error Message
 */
function saveErrorLog(message) {
    
    const now = new Date

    const day   = now.getDate().toString().padStart(2, '0')
    const month = now.getMonth().toString().padStart(2, '0')
    const year  = now.getFullYear().toString().padStart(4, '0')

    const timestamp = now.toISOString()

    const dir = "logs"

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }

    fs.appendFileSync(`${dir}/error_log_${year}_${month}_${day}.log`, `[${timestamp}]: ${message}\n`)
}

function canMakeApiCall() {
    return new Promise((resolve, reject) => {
        const today = new Date().toISOString().split('T')[0];
        if (dateLimits[today]) {
            db.get('SELECT count FROM api_usage WHERE date = ?', today, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row && row.count >= dateLimits[today]) {
                        resolve(false);
                    } else {
                        const newCount = row ? row.count + 1 : 1;
                        db.run('INSERT OR REPLACE INTO api_usage (date, count) VALUES (?, ?)', today, newCount, (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(true);
                            }
                        });
                    }
                }
            });
        } else {
            resolve(true);
        }
    });
}

app.post('/generate-image', async (req, res) => {
    
    try {
        const canCallApi = await canMakeApiCall();
        if (!canCallApi) {
            res.status(429).json({ message: 'API call limit reached for today. Please try again tomorrow.' });
            return;
        }

        const { description, customText } = req.body;
        const prompt = `Illustrated Disney Pixar, Christmas Postcard with ${description}. '${customText}' text in picture`;

        const response = await axios.post('https://api.openai.com/v1/images/generations', {
            model   : 'dall-e-3',
            prompt  : prompt,
            n       : 1,
            size    : '1024x1024',
        }, {
            headers: { Authorization: `Bearer ${DALLE_API_KEY}` },
        });

        if (response.status != 200 ||
            !response.data ||
            !response.data.data[0]
        ) {
            res.status(500).send('Error generating image')
            return
        }

        const imageUrl = response.data.data[0].url
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });

        if (imageResponse.status != 200 ||
            !imageResponse.data
        ) {
            res.status(500).send('Generated image is not valid')
            return
        }

        res.setHeader('Content-Type', 'image/png')
        res.send(imageResponse.data)

        
    } catch (error) {
        console.error(error);

        if (error.response?.data?.error) {
            saveErrorLog(JSON.stringify(error.response.data.error))
        } else {
            saveErrorLog(JSON.stringify(error))
        }

        res.status(500).send('Error calling DALL-E API');
    }

});

app.post('/persist-generated-image', upload.single('image'), async (req, res) => {

    const image = req.file;
    if (!image) {
        return res.status(400).send('Image is required');
    }

    try {

        // To Do: set filename to make sure no image replaces each other
        const randNum = String(Math.ceil(Math.random() * 9999)).padStart(4, '0')

        const dir = 'public/generated'

        const path = `${randNum}-${Date.now()}.png`

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir)
        }

        fs.writeFile(`${dir}/${path}`, image.buffer, error => {
            if (error) {
                throw new Error('Failed to persist the generated image')
            }

            const publicDir = dir.replace('public/', '')

            res.json({
                imageUrl: `${publicDir}/${path}`,
            })
        })

    } catch (error) {

        console.error(error)
        
        saveErrorLog(JSON.stringify(error))

        res.status(500).send('Error saving generated image');

    }
})

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});