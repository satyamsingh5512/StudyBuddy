export const getAvatarUrl = (user: any) => {
    if (!user) return 'https://via.placeholder.com/40';

    // 1. If photo type and has url, return it (Cloudinary)
    if (user.avatarType === 'photo' && user.avatar) {
        return user.avatar;
    }

    // 2. If legacy/fallback avatar string exists and we don't have a specific animated style, use it
    if (user.avatar && !user.avatarType?.startsWith('animated-')) {
        return user.avatar;
    }

    // 3. Dynamic Generation
    const seed = user.username || 'user';
    let style = 'adventurer'; // Default

    if (user.avatarType?.startsWith('animated-')) {
        style = user.avatarType.replace('animated-', '');
    } else if (user.avatarType === 'animated') {
        // Legacy animated without specific style in type
        // If we have an avatar URL in DB, we would have returned it in step 2.
        // If not, default to adventurer.
        style = 'adventurer';
    }

    return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
};
