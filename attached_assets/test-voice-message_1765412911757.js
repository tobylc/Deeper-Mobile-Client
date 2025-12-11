// Test script to verify voice message endpoint functionality
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function testVoiceMessageEndpoint() {
  try {
    console.log('Testing voice message endpoint...');
    
    // Create a simple test audio blob (empty for testing endpoint structure)
    const testAudioData = Buffer.from('test-audio-data');
    
    const formData = new FormData();
    formData.append('audio', testAudioData, {
      filename: 'test-voice.webm',
      contentType: 'audio/webm'
    });
    formData.append('senderEmail', 'test@example.com');
    formData.append('type', 'question');
    formData.append('duration', '10');

    const response = await fetch('http://localhost:5000/api/conversations/1/voice-messages', {
      method: 'POST',
      body: formData,
      headers: {
        'Cookie': 'session=test-session'
      }
    });

    console.log('Response status:', response.status);
    const result = await response.text();
    console.log('Response:', result);
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

// Run test
testVoiceMessageEndpoint();