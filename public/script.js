let globalImageUrl  = '' // Variable to store the image URL globally
let globalImageBlob
let polaroidBlob

// Function to fetch image as a blob
function fetchImageAsBlob(imageUrl) {
    return fetch(imageUrl)
        .then(response => response.blob())
        .catch(error => console.error('Error fetching image:', error));
}

/**
 * Hide element when after user submit
 */
function startLoading() {

    //const processingIndicator = document.getElementById('processingIndicator');
    //const loadingIndicator  = document.getElementById('loadingIndicator');
    const generatedImage    = document.getElementById('generatedImage');
    //const apiLimitMessage   = document.getElementById('apiLimitMessage');
    const closeSection = document.getElementById('closeSection');
    const sectionGate = document.getElementById('section-gate');
    const downloadButton    = document.getElementById('downloadButton');
    const shareButton       = document.getElementById('shareButton');
    const form              = document.getElementById('cardForm');

   // processingIndicator.style.display = 'none';
   // loadingIndicator.style.display  = 'block';
    generatedImage.style.display    = 'none';
   // apiLimitMessage.style.display   = 'none';
    downloadButton.style.display    = 'none';
    shareButton.style.display       = 'none';

    form.setAttribute('disabled', true)

}

/**
 * Convert base 64 string to image blob
 * 
 * @param {string} base64 Base 64 encoded image
 * @param {string} contentType mimetype of the image
 * @returns Blob object of the image
 */
async function base64ToBlob(base64, contentType = 'image/png') {
    return new Promise(resolve => {
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
        resolve(blob)
    })
}

/**
 * Merge generated image with the polaroid
 * 
 * @param {Blob} image the image blob
 * @returns 
 */
async function mergeImage(image) {
    //const processingIndicator = document.querySelector('#processingIndicator')
    //processingIndicator.style.display = 'block'

    try {

        const canvas    = document.querySelector('#drawingCanvas')
        const context   = canvas.getContext('2d')

        context.drawImage(await createImageBitmap(polaroidBlob), 0, 0)
        context.drawImage(await createImageBitmap(image), 45, 45, 718, 718)

        canvas.toBlob(blob => {
            globalImageBlob = blob

            persistGeneratedImage()
        })
        
    } catch (error) {

        console.error('Error:',error)
        alert('An error occured while merging image')

    } finally {
      //  processingIndicator.style.display = 'none'
      $('.open').click();
    }

}

/**
 * Persist generated image into the server
 */
async function persistGeneratedImage() {

   // const persistingIndicator = document.querySelector('#persistingIndicator')
   // persistingIndicator.style.display = 'block'

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
        //alert('An error occurred while persisting the image.');

    } finally {
      //  persistingIndicator.style.display = 'none';
        
    }
}

// Handle form submission for image generation
document.getElementById('cardForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = "PLEASE WAIT...";
    const element = document.getElementById('typePlease');
    let isAdding = true;
    let textIndex = 0;
    
    function updateText() {
      if (isAdding) {
        textIndex++;
        if (textIndex === text.length) {
          isAdding = false;
          setTimeout(updateText, 2000); // Wait 2 seconds at the end
          return;
        }
      } else {
        textIndex--;
        if (textIndex === -1) {
          isAdding = true;
          setTimeout(updateText, 500); // Delay before retyping
          return;
        }
      }
    
      element.innerText = text.substring(0, textIndex);
      setTimeout(updateText, 120); // Typing speed
    }
    
    updateText();
    $('.close').click();
    const description       = document.getElementById('description').value;
    const customText        = document.getElementById('customText').value;
    const loadingIndicator  = document.getElementById('loadingIndicator');
    const resultImage  = document.getElementById('resultImage');
    
    generatedImage.style.display    = 'block';
    startLoading()

    try {
        const [imageResponse, polaroidResponse] = await Promise.all([
            fetch('/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description, customText }),
            }),
            fetch(`${location.href}assets/frame.png`)
        ]);

        if (imageResponse.status === 429) {
            
          const delay = 2000; 
          
          setTimeout(() => {
            $('.open').click();
              closeSection.style.display = 'block';
          }, delay);
          
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
        
        //alert('An error occurred while generating the image because API limit.');

    } finally {
       // loadingIndicator.style.display = 'none';
        
        
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
          //  alert(error)
        })        

    } else {
        
        navigator.share({
            ...shareData,
            files: files
        })
        .catch(error => {
           // alert(error)
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
