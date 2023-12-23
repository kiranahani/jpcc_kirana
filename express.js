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

const db = new sqlite3.Database('api_usage.db', (err) => {
    if (err) {
        console.error(err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS api_usage (date TEXT PRIMARY KEY, count INTEGER)`);
});

const dateLimits = [
    {
        quota   : 72,
        date    : new Date('2023-12-19T00:00:00')
    },
    {
        quota   : 3000,
        date    : new Date('2023-12-25T00:00:00')
    },
    {
        quota   : 2000,
        date    : new Date('2023-12-26T00:00:00')
    },
    {
        quota   : 200,
        date    : new Date('2023-12-27T00:00:00')
    },
    {
        quota   : 200,
        date    : new Date('2023-12-28T00:00:00')
    },
    {
        quota   : 200,
        date    : new Date('2023-12-29T00:00:00')
    },
    {
        quota   : 200,
        date    : new Date('2023-12-30T00:00:00')
    },
    {
        quota   : 0,
        date    : new Date('2023-12-31T00:00:00')
    }
]

function canMakeApiCall() {
    return new Promise((resolve, reject) => {
        const now   = new Date()
        const today = now.toISOString().split('T')[0];

        if (dateLimits[0].date <= now &&
            dateLimits[dateLimits.length - 1].date >= now
        ) {
            resolve(false);
            return
        }

        let todaysCount = 0
        db.get('SELECT count FROM api_usage WHERE date = ?', [today], (err, row) => {
            if (err) {
                reject(err);
                return
            }

            todaysCount = row ? row.count : 0
        })

        db.get('SELECT SUM(count) as total FROM api_usage WHERE date <= ?', [today], (err, row) => {
            if (err) {
                reject(err);
                return
            }

            const currentCount = row ? row.total : 0;
            let quotaAvailable = 0
            dateLimits.forEach((limit) => {
                if (limit.date < now) {
                    quotaAvailable += limit.quota
                }
            })

            if (quotaAvailable - currentCount < 1) {
                resolve(false)
                return
            }

            const newCount = todaysCount + 1;
            db.run('INSERT OR REPLACE INTO api_usage (date, count) VALUES (?, ?)', [today, newCount], (err) => {
                if (err) {
                    reject(err);
                    return
                }

                resolve(true);
            });
        });
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
        const prompt = `Illustrated Disney Pixar, Christmas Postcard with ${description}. Merry Christmas text must be in picture handwritten font, '${customText}' text must be in picture,  ensuring all elements are centrally composed to prevent cropping and all the text is inside the picture `;

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

        if (error.response?.data?.error) {
            saveErrorLog(JSON.stringify(error.response.data.error))
        } else {
            saveErrorLog(JSON.stringify(error))
        }

        console.error(error);
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

// app.get('/serve-image', async (req, res) => {
//     const imageUrl = req.query.url;
//     if (!imageUrl) {
//         return res.status(400).send('Image URL is required');
//     }

//     try {
//         const response = await axios({
//             method: 'GET',
//             url: imageUrl,
//             responseType: 'stream'
//         });

//         const imagePath = path.join(__dirname, 'img', 'downloadedImage.jpg'); // Change 'downloadedImage.jpg' to the desired file name
//         const writer = fs.createWriteStream(imagePath);

//         response.data.pipe(writer);

//         writer.on('finish', () => {
//             res.send({ message: 'Image downloaded successfully', path: imagePath });
//         });

//         writer.on('error', (err) => {
//             console.error('Error writing image to disk', err);
//             res.status(500).send('Error saving image');
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Error fetching image');
//     }
// });

function saveImageToServer(imageUrl) {
    fetch(`/save-image?url=${encodeURIComponent(imageUrl)}`)
    .then(response => response.json())
    .then(data => {
        if (data.message === 'Image saved successfully') {
            console.log('Image saved to server:', data.path);
            // Tindakan selanjutnya setelah gambar berhasil disimpan
        } else {
            console.error('Server failed to save the image.');
        }
    })
    .catch(error => {
        console.error('Error saving image to server:', error);
    });
}

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});