let globalImageUrl = ''; // Variable to store the image URL globally

// Function to fetch image as a blob
function fetchImageAsBlob(imageUrl) {
    return fetch(imageUrl)
        .then(response => response.blob())
        .catch(error => console.error('Error fetching image:', error));
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
        } else if (response.ok) {
            const data = await response.json();
            if (data.imageUrl) {
                globalImageUrl = data.imageUrl;
                generatedImage.src = data.imageUrl;
                generatedImage.style.display = 'block';
                downloadButton.style.display = 'block';
                shareButton.style.display = 'block';
            } else {
                alert('No image was returned. Please try again.');
            }
        } else {
            throw new Error(`Server responded with status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while generating the image.');
    } finally {
        loadingIndicator.style.display = 'none';
    }
});

// Handle image download
document.getElementById('downloadButton').addEventListener('click', () => {
    if (globalImageUrl) {
        const downloadingMessage = document.getElementById('downloadingMessage');
        const downloadCompleteMessage = document.getElementById('downloadCompleteMessage');

        downloadingMessage.style.display = 'block';
        downloadCompleteMessage.style.display = 'none';

        const proxyUrl = `/download-image?url=${encodeURIComponent(globalImageUrl)}`;
        fetch(proxyUrl)
            .then(res => res.blob())
            .then(blob => {
                const imageUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = 'custom_christmas_card.jpg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(imageUrl);

                downloadingMessage.style.display = 'none';
                downloadCompleteMessage.style.display = 'block';
            })
            .catch(error => {
                console.error('Error downloading the image:', error);
                alert('An error occurred while downloading the image.');
                downloadingMessage.style.display = 'none';
            });
    }
});
document.getElementById('shareButton').addEventListener('click', function() {
    const proxyUrl = `/download-image?url=${encodeURIComponent(globalImageUrl)}`;
        fetch(proxyUrl)
            .then(res => res.blob())
            .then(blob => {
                const imageUrl = URL.createObjectURL(blob);;
                fetch(`/download-image?url=${encodeURIComponent(imageUrl)}`)
                .then(response => response.text())
                .then(text => alert(text))
                .catch(error => console.error('Error:', error));
            })
    
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
