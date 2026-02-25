import 'dotenv/config';

async function main() {
    try {
        const res = await fetch('http://localhost:3001/api/news/cache/clear', {
            method: 'POST'
        });
        console.log(await res.json());
    } catch (err) {
        console.error(err);
    }
}
main();
