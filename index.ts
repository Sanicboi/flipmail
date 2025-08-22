import "dotenv/config";
import fs from "fs"
import OpenAI from "openai";
import path from "path";
import { Api, TelegramClient } from "telegram";
import { NewMessage } from "telegram/events";
import { StringSession } from "telegram/sessions";



(async () => {


    const USERNAME = "strongingreg";
    const prompt = fs.readFileSync(
        path.join(process.cwd(), 'prompt.txt'),
        'utf-8'
    );
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_TOKEN!
    });
    const client = new TelegramClient(
        new StringSession(process.env.TG_TOKEN!),
        +process.env.TG_API_ID!,
        process.env.TG_API_HASH!,
        {}
    );
    await client.connect();


    let resId: string = '';
    let fileId: string = '';

    {
        const files = await openai.files.list({
            purpose: 'assistants'
        });
        const f = files.data.find(el => el.filename === 'db.pdf');
        if (f) {
            fileId = f.id;
        } else {
            const r = await openai.files.create({
                file: fs.createReadStream(path.join(process.cwd(), 'db.pdf')),
                purpose: 'assistants',
            });
            fileId = r.id;
        }
    }
    

    const fRes = await openai.responses.create({
        model: 'gpt-4.1-mini',
        instructions: prompt,
        store: true,
        input: [
            {
                role: 'user',
                content: [
                    {
                        type: 'input_file',
                        file_id: fileId,
                    },
                    {
                        type: 'input_text',
                        text: 'Начни диалог. Пользователя зовут Григорий.'
                    }
                ]
            }
        ]
    });

    resId = fRes.id;
    await client.sendMessage(USERNAME, {
        message: fRes.output_text
    });

    client.addEventHandler(async (e) => {
        if (!e.isPrivate) return;
        const dialogs = await client.getDialogs();
        const uDialog = dialogs.find(el => el.entity?.id === e.message.senderId);
        if (!uDialog) return;
        const entity = uDialog.entity as Api.User;
        if (entity.username !== USERNAME) return;

        const res = await openai.responses.create({
            model: 'gpt-4.1-mini',
            instructions: prompt,
            previous_response_id: resId,
            store: true,
            input: e.message.text
        });
        resId = res.id;
        await client.sendMessage(USERNAME, {
            message: res.output_text
        });
    }, new NewMessage())
})