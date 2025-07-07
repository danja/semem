import { createHash } from 'crypto';

export class URIMinter {
    static mintURI(URIBase = 'http://purl.org/stuff/instance/', slug = 'semem', content = null) {
        if (content) {
            const hash = createHash('sha256').update(content).digest('hex');
            return `${URIBase}${slug}-${hash.substring(0, 8)}`;
        } else {
            const randomId = Math.random().toString(36).substring(2, 10);
            return `${URIBase}${slug}-${randomId}`;
        }
    }
}