document.addEventListener("DOMContentLoaded", function () {
    var navToggle = document.querySelector(".nav__toggle");
    var navPanel = document.querySelector(".nav__panel");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (navToggle && navPanel) {
        var closeNav = function () {
            navPanel.classList.remove("is-open");
            navToggle.setAttribute("aria-expanded", "false");
            document.body.classList.remove("nav-open");
        };

        navToggle.addEventListener("click", function () {
            var isOpen = navPanel.classList.toggle("is-open");
            navToggle.setAttribute("aria-expanded", String(isOpen));
            document.body.classList.toggle("nav-open", isOpen);
        });

        navPanel.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                closeNav();
            });
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeNav();
            }
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth > 1024) {
                closeNav();
            }
        });
    }

    var countItems = document.querySelectorAll("[data-count]");
    var animateCount = function (item) {
        if (item.dataset.countAnimated === "true") {
            return;
        }

        var target = parseInt(item.getAttribute("data-count"), 10);
        if (isNaN(target)) {
            return;
        }

        item.dataset.countAnimated = "true";

        if (reduceMotion.matches) {
            item.textContent = String(target);
            return;
        }

        var duration = 950;
        var startTime = null;

        var tick = function (timestamp) {
            if (!startTime) {
                startTime = timestamp;
            }

            var progress = Math.min((timestamp - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            item.textContent = String(Math.round(target * eased));

            if (progress < 1) {
                window.requestAnimationFrame(tick);
            }
        };

        window.requestAnimationFrame(tick);
    };

    if (countItems.length) {
        if ("IntersectionObserver" in window) {
            var countObserver = new IntersectionObserver(
                function (entries, activeObserver) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting || entry.intersectionRatio > 0) {
                            animateCount(entry.target);
                            activeObserver.unobserve(entry.target);
                        }
                    });
                },
                {
                    threshold: 0.35
                }
            );

            countItems.forEach(function (item) {
                countObserver.observe(item);
            });
        } else {
            countItems.forEach(animateCount);
        }
    }

    document.querySelectorAll("[data-console-steps]").forEach(function (group) {
        var steps = group.querySelectorAll(".console-step");
        var activeIndex = 0;

        if (reduceMotion.matches || steps.length < 2) {
            return;
        }

        window.setInterval(function () {
            steps[activeIndex].classList.remove("is-active");
            activeIndex = (activeIndex + 1) % steps.length;
            steps[activeIndex].classList.add("is-active");
        }, 2200);
    });

    var revealItems = document.querySelectorAll(".reveal");
    if (!revealItems.length) {
        return;
    }

    if (reduceMotion.matches) {
        revealItems.forEach(function (item) {
            item.classList.add("is-visible");
        });
        return;
    }

    if (!("IntersectionObserver" in window)) {
        revealItems.forEach(function (item) {
            item.classList.add("is-visible");
        });
        return;
    }

    var observer = new IntersectionObserver(
        function (entries, activeObserver) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting || entry.intersectionRatio > 0) {
                    entry.target.classList.add("is-visible");
                    activeObserver.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.01,
            rootMargin: "0px 0px -8% 0px"
        }
    );

    revealItems.forEach(function (item) {
        observer.observe(item);
    });
});
