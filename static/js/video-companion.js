(() => {
    const videos = Array.from(document.querySelectorAll('.companion-portrait'));
    videos.forEach((video) => {
        video.addEventListener('play', () => {
            videos.forEach((other) => {
                if (other !== video) other.pause();
            });
        });
    });

    const trigger = document.querySelector('[data-youtube-id]');
    if (!trigger || !/^[A-Za-z0-9_-]{11}$/.test(trigger.dataset.youtubeId)) return;

    trigger.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        videos.forEach((video) => video.pause());
        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${trigger.dataset.youtubeId}?autoplay=1&rel=0`;
        frame.title = trigger.getAttribute('aria-label');
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        trigger.replaceWith(frame);
        frame.focus();
    });
})();
