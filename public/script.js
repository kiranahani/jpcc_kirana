let globalImageUrl  = '' // Variable to store the image URL globally
let globalImageBlob

// Function to fetch image as a blob
function fetchImageAsBlob(imageUrl) {
    return fetch(imageUrl)
        .then(response => response.blob())
        .catch(error => console.error('Error fetching image:', error));
}

/**
 * Convert base 64 string to image blob
 * 
 * @param {string} base64 Base 64 encoded image
 * @param {string} contentType mimetype of the image
 * @returns Blob object of the image
 */
function base64ToBlob(base64, contentType = 'image/png') {

    const sliceSize = 512

    const byteCharacters    = atob(base64);
    const byteArrays        = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {

        const slice = byteCharacters.slice(offset, offset + sliceSize)
    
        const byteNumbers = new Array(slice.length)
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i)
        }
    
        const byteArray = new Uint8Array(byteNumbers)
        byteArrays.push(byteArray)

    }
    
    const blob = new Blob(byteArrays, {type: contentType})
    return blob

}

// Handle form submission for image generation
document.getElementById('cardForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const description = document.getElementById('description').value;
    const customText = document.getElementById('customText').value;
    const loadingIndicator = document.getElementById('loadingIndicator');
    const generatedImage = document.getElementById('generatedImage');
    const apiLimitMessage = document.getElementById('apiLimitMessage');
    const downloadButton = document.getElementById('downloadButton');
    const shareButton = document.getElementById('shareButton');

    loadingIndicator.style.display = 'block';
    generatedImage.style.display = 'none';
    apiLimitMessage.style.display = 'none';
    downloadButton.style.display = 'none';
    shareButton.style.display = 'none';

    try {
        const response = await fetch('/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, customText }),
        });

        if (response.status === 429) {
            apiLimitMessage.style.display = 'block';
            return
        } 

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.imageUrl || !data.base64Blob) {
            alert('No image was returned. Please try again.');
            return
        }

        globalImageBlob = base64ToBlob(data.base64Blob)
        globalImageUrl  = data.imageUrl;


        generatedImage.src = data.imageUrl;
        generatedImage.style.display = 'block';
        downloadButton.style.display = 'block';
        shareButton.style.display = 'block';
        
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while generating the image.');
    } finally {
        loadingIndicator.style.display = 'none';
    }
});

// Handle image download
document.getElementById('downloadButton').addEventListener('click', () => {
    
    if (!globalImageUrl) {
        alert('Failed to get image')
        return
    }

    const anchor = document.createElement('a')

    anchor.href             = globalImageUrl
    anchor.download         = "generated_christmas_card.png"
    anchor.style.display    = 'none'

    document.body.appendChild(anchor)

    anchor.click()

    document.body.removeChild(anchor)

});

document.getElementById('shareButton').addEventListener('click', function() {

    if (!globalImageBlob) {
        alert('Image is not fully downloaded yet')
        return
    }

    if (typeof navigator.canShare == 'undefined') {
        alert ('Your device does not support the operation')
        return
    }

    const mime = blob.type

    const extension = mime.replace('image/', '')

    const file = new File([blob], `generated_image.${extension}`, { type: mime })

    if (!navigator.canShare({files: [file]})) {

        navigator.share({
            title   : "Generated Christmas Card",
            url     : `${window.location.href}${globalImageUrl}`
        }).catch(error => {
            alert(error)
        })

    } else {

        navigator.share({
            title   : "Generated Christmas Card",
            url     : `${window.location.href}${globalImageUrl}`,
            files   : [file]
        }).catch(error => {
            alert(error)
        })

    }
    
});

// Handle image sharing
// document.getElementById('shareButton').addEventListener('click', () => {
//     const generatedImage = document.getElementById('generatedImage');
    
//     if (generatedImage && generatedImage.src) {
//         fetch(generatedImage.src,{
//             mode: 'no-cors'
//         })
//             .then(response => {
//                 response.blob()
//                 console.log('Request made with no-cors mode');
//             })
//             .then(blob => {
//                 const file = new File([blob], 'custom_christmas_card.png', { type: 'image/png' });
//                 if (navigator.canShare && navigator.canShare({ files: [file] })) {
//                     // Try sharing the image file
//                     navigator.share({
//                         files: [file],
//                         title: 'Custom Christmas Card',
//                         text: 'Check out this custom Christmas card I created!'
//                     }).then(() => {
//                         console.log('Successful share');
//                     }).catch((error) => {
//                         console.log('Error sharing:', error);
//                     });
//                 } else {
//                     console.log("Sharing not supported for this file.");
//                 }
//             })
//             .catch(error => console.error('Error fetching the image:', error));
//     } else {
//         console.log("No image available to share.");
//     }
// });
