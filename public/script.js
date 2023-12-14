let globalImageUrl  = '' // Variable to store the image URL globally
let globalImageBlob
let polaroidBlob

/**
 * Hide element when after user submit
 */
function startLoading() {

    const processingIndicator = document.getElementById('processingIndicator');
    const loadingIndicator  = document.getElementById('loadingIndicator');
    const generatedImage    = document.getElementById('generatedImage');
    const apiLimitMessage   = document.getElementById('apiLimitMessage');
    const downloadButton    = document.getElementById('downloadButton');
    const shareButton       = document.getElementById('shareButton');
    const form              = document.getElementById('cardForm');

    processingIndicator.style.display = 'none';
    loadingIndicator.style.display  = 'block';
    generatedImage.style.display    = 'none';
    apiLimitMessage.style.display   = 'none';
    downloadButton.style.display    = 'none';
    shareButton.style.display       = 'none';

    form.setAttribute('disabled', true)

}

/**
 * Merge generated image with the polaroid
 * 
 * @param {Blob} image the image blob
 * @returns 
 */
async function mergeImage(image) {
    const processingIndicator = document.querySelector('#processingIndicator')
    processingIndicator.style.display = 'block'

    try {

        const canvas    = document.querySelector('#drawingCanvas')
        const context   = canvas.getContext('2d')

        context.drawImage(await createImageBitmap(polaroidBlob), 0, 0)
        context.drawImage(await createImageBitmap(image), 152, 45, 718, 718)

        canvas.toBlob(blob => {
            globalImageBlob = blob

            persistGeneratedImage()
        })
        
    } catch (error) {

        console.error('Error:',error)
        alert('An error occured while merging image')

    } finally {
        processingIndicator.style.display = 'none'
    }

}

/**
 * Persist generated image into the server
 */
async function persistGeneratedImage() {

    const persistingIndicator = document.querySelector('#persistingIndicator')
    persistingIndicator.style.display = 'block'

    try {

        const formData = new FormData

        formData.append('image', globalImageBlob)

        const response = await fetch('/persist-generated-image', {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`)
        }

        const data = await response.json()
        if (!data.imageUrl) {
            throw new Error('Invalid response from backend')
        }

        globalImageUrl = data.imageUrl

        const shareButton       = document.querySelector('#shareButton')
        const downloadButton    = document.querySelector('#downloadButton')
        const imageDisplay      = document.querySelector('#generatedImage')

        if (!shareButton ||
            !downloadButton ||
            !imageDisplay
        ) {
            alert("Missing elements!")
            return
        }

        imageDisplay.setAttribute('src', globalImageUrl)
        
        imageDisplay.style.display      = 'block'
        downloadButton.style.display    = 'block'
        shareButton.style.display       = 'block'

    } catch (error) {
        
        console.error('Error:', error);
        alert('An error occurred while persisting the image.');

    } finally {
        persistingIndicator.style.display = 'none';
        
    }
}


/** --- Event Handlers --- */

// Handle form submission for image generation
document.getElementById('cardForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const description       = document.getElementById('description').value;
    const customText        = document.getElementById('customText').value;
    const loadingIndicator  = document.getElementById('loadingIndicator');

    startLoading()

    try {
        const [imageResponse, polaroidResponse] = await Promise.all([
            fetch('/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description, customText }),
            }),
            fetch(`${location.href}assets/polaroid.png`)
        ]);

        if (imageResponse.status === 429) {
            apiLimitMessage.style.display = 'block';
            return
        } 

        if (!imageResponse.ok) {
            throw new Error(`Server responded with status: ${imageResponse.status}`);
        }

        const data = await imageResponse.blob();

        if (!polaroidResponse.ok) {
            alert('Failed to fetch the polaroid')
            return
        }
        polaroidBlob = await polaroidResponse.blob()

        // To Do: Show progress
        console.log("Image successfully generated, processing the image ...")

        await mergeImage(data)
        
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

    const mime      = globalImageBlob.type
    const extension = mime.replace('image/', '')
    const files     = [new File([globalImageBlob], `generatedImage.${extension}`, { type: mime })]

    const shareData = {
        title   : "Generated Christmas Card",
        text    : "Merry Christmas!",
        url     : `${window.location.href}${globalImageUrl}`,
    }

    if (!navigator.canShare) {
        alert ('You are not in https connection or your device does not support the operation')
        return
    }

    if (!navigator.canShare({ files })) {

        navigator.share(shareData)
        .catch(error => {

            // Custom pop up batal share di sini

            if (error.name && error.name == 'AbortError') {
                return
            }

            alert(error)
        })        

    } else {
        
        navigator.share({
            ...shareData,
            files: files
        })
        .catch(error => {

            // Custom pop up batal share di sini

            if (error.name && error.name == 'AbortError') {
                return
            }

            alert(error)
        })

    }
    
});
