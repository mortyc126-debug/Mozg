from regime_neighborhood import run_neighborhood


if __name__ == "__main__":
    for development_seed in (22, 33):
        run_neighborhood(
            development_seed=development_seed
        )
