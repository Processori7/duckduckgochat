document.getElementById('send-button').addEventListener('click', sendMessage);
document.getElementById('clear-button').addEventListener('click', clearChat);
document.getElementById('save-chat-button').addEventListener('click', saveChat);

const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const modelSelect = document.getElementById('model-select');

const MODEL_MAPPING = {
    "claude-3-haiku": "claude-3-haiku-20240307",
    "llama-3.1-70b": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    "mixtral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "gpt-4o-mini": "gpt-4o-mini"
};

async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (!userMessage) {
        console.error('Пожалуйста, введите вопрос.');
        return;
    }

    const selectedModel = modelSelect.value;
    const model = MODEL_MAPPING[selectedModel] || selectedModel;

    // Добавляем сообщение пользователя в чат
    addMessage(userMessage, 'user');

    // Очищаем поле ввода
    messageInput.value = '';

    // Отправляем запрос к API
    try {
        const vqd = await getVQD();

        const response = await fetch('https://duckduckgo.com/duckchat/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkNjUxMDc1LTQxNjAtNDY0YS1iMzMyLTQwNWYwNmQ1NDMyNCIsImV4cCI6MTczOTM2NjY5OH0.2lVKlKzc--eXHUmQnjRBaiBNFmJL62vHksDFR79Y_-o',
                'x-vqd-4': vqd
            },
            body: JSON.stringify({
                "model": model,
                "messages": [{"role": "user", "content": userMessage}]
            })
        });

        if (!response.ok) {
            throw new Error(`Ошибка: ${response.statusText} (${response.status})`);
        }

        // Обработка потоковых данных
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const data = line.substring(5).trim();
                    if (data === '[DONE]') {
                        break;
                    }
                    try {
                        const json = JSON.parse(data);
                        const botMessage = json.message || '';
                        fullContent += botMessage;
                    } catch (parseError) {
                        console.error('Ошибка парсинга JSON:', parseError);
                        console.error('Данные:', data);
                    }
                }
            }
        }

        // Добавляем итоговое сообщение бота в чат
        addMessage(fullContent, 'bot');
    } catch (error) {
        console.error('Произошла ошибка при получении ответа:', error);
        addMessage('Произошла ошибка при получении ответа.', 'bot');
    }
}

function addMessage(content, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    messageElement.innerText = content;
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function clearChat() {
    chatContainer.innerHTML = '';
}

async function getVQD() {
    try {
        const resp = await fetch('https://duckduckgo.com/duckchat/v1/status', {
            headers: {"x-vqd-accept": "1"}
        });
        if (!resp.ok) {
            throw new Error(`Ошибка получения VQD: ${resp.statusText}`);
        }
        return resp.headers.get('x-vqd-4') || '';
    } catch (error) {
        console.error('Ошибка получения VQD:', error);
        return '';
    }
}

function saveChat() {
    const messages = chatContainer.getElementsByClassName('message');
    let chatText = '';

    for (const message of messages) {
        chatText += `${message.className.includes('user-message') ? 'Вы: ' : 'Бот: '} ${message.innerText}\n`;
    }

    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('Чат сохранен');
}

// Обработка нажатия Enter для отправки сообщения
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
