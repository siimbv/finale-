// Load xlsx dynamically
async function loadXlsxScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://oss.sheetjs.com/sheetjs/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Function to parse Excel file using xlsx library
async function parseExcelFile(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);

            // Make sure XLSX is defined after loading the script
            await loadXlsxScript();

            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            resolve(jsonData);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(blob);
    });
}

// Function to handle file selection
function selectFile(event) {
    const fileList = document.getElementById('fileList');
    // ...

    // Save the updated file list to local storage
    localStorage.setItem('uploadedFiles', JSON.stringify(files));
}

// Function to get the uploaded files from local storage
async function getUploadedFiles() {
    try {
        // Attempt to get the uploaded files from local storage
        const storedFiles = localStorage.getItem('uploadedFiles');
        return storedFiles ? JSON.parse(storedFiles) : [];
    } catch (error) {
        console.error('Error getting uploaded files:', error);
        return [];
    }
}

// Function to update the file list and save it to local storage
async function updateFileList(files) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    files.forEach((file) => {
        const listItem = document.createElement('li');
        listItem.innerText = file;
        fileList.appendChild(listItem);
    });

    // Save the updated file list to local storage
    localStorage.setItem('uploadedFiles', JSON.stringify(files));
}


// Function to upload a file
async function uploadFile() {
    const fileInput = document.getElementById('fileInput');

    // Check if a file is selected
    if (!fileInput.files || fileInput.files.length === 0) {
        console.error('No file selected.');
        return;
    }

    const formData = new FormData();
    formData.append('excelFile', fileInput.files[0]);

    try {
        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            // Update the file list
            updateFileList(await getUploadedFiles());
        } else {
            console.error('File upload failed with status', response.status);
            const errorText = await response.text();
            console.error('Error message:', errorText);
        }
    } catch (error) {
        console.error('Error uploading file:', error);
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    try {
        // Load xlsx dynamically
        await loadXlsxScript();

        // xlsx is now loaded, you can call functions that depend on it
        console.log('xlsx library is loaded');

        // Get the uploaded files from local storage
        const storedFiles = await getUploadedFiles();

        // Call your functions that depend on xlsx
        updateFileList(storedFiles);

        // Attach the event listener for the submit button
        document.getElementById('submitButton').addEventListener('click', async function (event) {
            console.log('Click event:', event);

            // Get the usernames from the form
            const username1 = document.getElementById('username1').value;
            const username2 = document.getElementById('username2').value;

            // Call the function to run your specific server-side logic
            await executeServerLogic(username1, username2);
        });
    } catch (error) {
        console.error('Error loading xlsx library:', error);
    }
});

// Function to execute your specific server-side logic
async function executeServerLogic(username1, username2) {
    console.log('Executing server logic for', username1, username2);
    console.log('Usernames:', username1, username2);


    try {
        // Use Fetch API to send a POST request to your server
        const response = await fetch('/run-server-script', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username1, username2 }),
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log('Response data:', data);


        console.log(data); // Log the response from the server-side logic

        // Check if both users are found in the Excel sheet
        const user1Found = data.user1Found;
        const user2Found = data.user2Found;

        if (!user1Found || !user2Found) {
            displayMessage('User not found in the Excel sheet', 'error');
            return;
        }

        // Display a success or error message based on the server response
        if (data.message === 'Server script executed successfully') {
            displayMessage('Swap accepted', 'success');
        } else {
            displayMessage('Swap rejected', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        displayMessage('Error executing server script', 'error'); // Display error message
    }
}

// Function to display a message on the website
function displayMessage(message, messageType) {
    const messageElement = document.getElementById('statusMessage');
    const swapStatusElement = document.getElementById('swapStatus');

    // Check if messageElement and swapStatusElement exist
    if (!messageElement || !swapStatusElement) {
        console.error('Elements not found.');
        return;
    }

    // Set the message content and style based on the message type
    messageElement.textContent = message;

    if (messageType === 'success') {
        swapStatusElement.textContent = 'Swap accepted';
        swapStatusElement.className = 'swap-status success';
    } else if (messageType === 'error') {
        swapStatusElement.textContent = 'Swap rejected';
        swapStatusElement.className = 'swap-status error';
    } else {
        swapStatusElement.textContent = '';
        swapStatusElement.className = '';
    }

// Function to handle the result and update the resultContainer
function handleResult(data) {
    const resultContainer = document.getElementById('resultContainer');

    if (data.message === 'Swap Rejected') {
        if (data.reason) {
            // Update the resultContainer with the rejection reason
            resultContainer.innerHTML = `Swap Rejected: ${data.reason}`;
        } else {
            resultContainer.innerHTML = 'Swap Rejected';
        }
    } else {
        resultContainer.innerHTML = 'Server script executed successfully';
    }
}


    // Clear the message after a certain duration (e.g., 5 seconds)
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = '';
        swapStatusElement.textContent = '';
        swapStatusElement.className = '';
    }, 5000); // Adjust the duration as needed
}
