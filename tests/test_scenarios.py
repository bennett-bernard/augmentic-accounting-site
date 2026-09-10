import json
import re

from fastapi.testclient import TestClient

from main import app
from scenario_firms import FIRMS, SCENARIOS, SCENARIO_REDIRECTS
from scripts.build_static import collect_routes, build_static, output_file_for


def test_all_fifteen_samples_are_distinct_and_buildable():
    routes = collect_routes()
    assert len(FIRMS) == len({firm['theme'] for firm in FIRMS}) == 5
    with TestClient(app) as client:
        for firm in FIRMS:
            for scenario in SCENARIOS:
                path = f"/webmcp/{firm['slug']}/{scenario}"
                assert path in routes
                response = client.get(path)
                assert response.status_code == 200
                assert f'theme-{firm["theme"]}' in response.text
                assert '<meta name="robots" content="noindex, nofollow">' in response.text
                assert 'googletagmanager' not in response.text
                config = json.loads(re.search(r'id="scenario-config" type="application/json">(.*?)</script>', response.text).group(1))
                assert config['firm'] == firm
                assert config['scenario'] == scenario
        lab = client.get('/webmcp').text
        assert lab.count('class="sample-primary"') == 15
        assert lab.count('class="baseline-link"') == 15
        assert client.get('/webmcp/johnsoncpa').status_code == 200
        assert '/webmcp/johnsoncpa/contact-me' in lab
        assert client.get('/unknown-firm/contact-me').status_code == 404


def test_legacy_routes_redirect_without_losing_experiment_parameters():
    routes = collect_routes()
    query = "?webmcp=off&date=2026-09-14"
    with TestClient(app) as client:
        for old, new in SCENARIO_REDIRECTS.items():
            response = client.get(old + query, follow_redirects=False)
            assert response.status_code == 301
            assert response.headers['location'] == new + query
            assert old not in routes
            assert new in routes


def test_static_build_publishes_redirects_and_only_new_scenario_paths(tmp_path):
    routes = build_static(tmp_path)
    redirects = (tmp_path / '_redirects').read_text().splitlines()
    assert set(redirects) == {f"{old} {new} 301" for old, new in SCENARIO_REDIRECTS.items()}
    for old in SCENARIO_REDIRECTS:
        assert not output_file_for(old, tmp_path).exists()
    assert len([route for route in routes if route.startswith('/webmcp/')]) == 20
    assert '/webmcp' in routes
