document.addEventListener("DOMContentLoaded", function () {
    var navToggle = document.querySelector(".nav__toggle");
    var navPanel = document.querySelector(".nav__panel");

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
            if (window.innerWidth > 860) {
                closeNav();
            }
        });
    }

    var revealItems = document.querySelectorAll(".reveal");
    if (!revealItems.length) {
        return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        revealItems.forEach(function (item) {
            item.classList.add("is-visible");
        });
        return;
    }

    var observer = new IntersectionObserver(
        function (entries, activeObserver) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    activeObserver.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.2,
            rootMargin: "0px 0px -40px 0px"
        }
    );

    revealItems.forEach(function (item) {
        observer.observe(item);
    });
});
