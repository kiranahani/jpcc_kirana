const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
        }, {
            headers: { Authorization: `Bearer ${DALLE_API_KEY}` },
        });

        if (response.status === 200 && response.data && response.data.data[0]) {
            res.json({ imageUrl: response.data.data[0].url });
        } else {
            res.status(500).send('Error generating image');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error calling DALL-E API');
    }
});

app.get('/download-image', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
        return res.status(400).send('Image URL is required');
    }

    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

        // To Do: set filename to make sure no image replaces each other
        const randNum = String(Math.ceil(Math.random() * 9999)).padStart(4, '0')
        const path = `temp/${randNum}-${Date.now()}.png`

        fs.writeFile(`public/${path}`, response.data, err => {
            if (err) {
                throw err
            }

            res.send({ imageUrl : path });
            
        })

    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching image');
    }
});

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

app.get('/download-image', async (req, res) => {
    const imageUrl = req.query.url; // URL diharapkan sebagai parameter query
    try {
        const savedFilePath = await downloadImage(imageUrl); // Gunakan fungsi yang didefinisikan di atas
        res.send(`Gambar berhasil diunduh ke: ${savedFilePath}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Tidak dapat mengunduh gambar');
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});